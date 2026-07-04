"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { NOTIFICATION_TYPES, ROLES, SESSION_STATUS, USER_STATUS } from "@/lib/constants";
import { formatHours } from "@/lib/format";
import {
  EMAIL_RE,
  normalizeEmail,
  parseHoursField,
  type ActionState,
} from "@/lib/actions/shared";

const STAFF_ROLES: string[] = [ROLES.ADMIN, ROLES.DEPT_LEADER, ROLES.SALES];

/**
 * Create a student (email + cohort). Admin may create anywhere and may grant
 * initial hours (audited); Dept Leader / Sales only inside their own program
 * and never with hours.
 */
export async function createStudent(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || !STAFF_ROLES.includes(actor.role)) {
    return { ok: false, error: "You aren't allowed to create students." };
  }

  const email = normalizeEmail(formData.get("email"));
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const name = String(formData.get("name") ?? "").trim() || null;

  const cohortId = String(formData.get("cohortId") ?? "");
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    include: { program: true },
  });
  if (!cohort) return { ok: false, error: "Pick a cohort." };

  if (actor.role !== ROLES.ADMIN && cohort.programId !== actor.programId) {
    return {
      ok: false,
      error: "You can only create students in your own program.",
    };
  }

  // Initial hours: admin-only. The field isn't rendered for other roles, but
  // enforce it server-side regardless.
  let initialHours = 0;
  const rawInitial = formData.get("initialHours");
  if (actor.role === ROLES.ADMIN && String(rawInitial ?? "").trim() !== "") {
    const parsed = parseHoursField(rawInitial, {
      min: 0,
      label: "Initial hours",
    });
    if ("error" in parsed) return { ok: false, error: parsed.error };
    initialHours = parsed.value;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: `${email} already has an account.` };
  }

  await prisma.$transaction(async (tx) => {
    const studentUser = await tx.user.create({
      data: {
        email,
        name,
        role: ROLES.STUDENT,
        status: USER_STATUS.ACTIVE,
      },
    });
    const profile = await tx.studentProfile.create({
      data: {
        userId: studentUser.id,
        cohortId: cohort.id,
        allottedHours: initialHours,
        createdById: actor.id,
      },
    });
    if (initialHours > 0) {
      await tx.hourAllotmentChange.create({
        data: {
          studentId: profile.id,
          changedById: actor.id,
          oldHours: 0,
          newHours: initialHours,
        },
      });
      await tx.notification.create({
        data: {
          userId: studentUser.id,
          type: NOTIFICATION_TYPES.HOURS_GRANTED,
          message: `You were granted ${formatHours(initialHours)} mentoring hours.`,
        },
      });
    }
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Student ${email} created in ${cohort.program.name} / ${cohort.name}.`,
  };
}

/**
 * Set a student's total allotted hours. Admin only (spec §3 key rule) —
 * always audited, always notifies the student.
 */
export async function setAllottedHours(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can change hour allotments." };
  }

  const profileId = String(formData.get("studentProfileId") ?? "");
  const parsed = parseHoursField(formData.get("newHours"), {
    min: 0,
    label: "Allotted hours",
  });
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const newHours = parsed.value;

  const profile = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    include: { user: true },
  });
  if (!profile) return { ok: false, error: "Student not found." };

  const oldHours = profile.allottedHours;
  if (newHours === oldHours) {
    return { ok: true, message: "No change — allotment already at that value." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.studentProfile.update({
      where: { id: profile.id },
      data: { allottedHours: newHours },
    });
    await tx.hourAllotmentChange.create({
      data: {
        studentId: profile.id,
        changedById: actor.id,
        oldHours,
        newHours,
      },
    });
    const delta = newHours - oldHours;
    await tx.notification.create({
      data: {
        userId: profile.userId,
        type: NOTIFICATION_TYPES.HOURS_GRANTED,
        message:
          delta > 0
            ? `You were granted ${formatHours(delta)} more mentoring hours (total ${formatHours(newHours)}).`
            : `Your allotted mentoring hours were adjusted from ${formatHours(oldHours)} to ${formatHours(newHours)}.`,
      },
    });
  });

  revalidatePath("/", "layout");

  const completed = await prisma.session.aggregate({
    where: { studentId: profile.id, status: SESSION_STATUS.ACTIVE },
    _sum: { hours: true },
  });
  const remaining = newHours - (completed._sum.hours ?? 0);
  return {
    ok: true,
    message: `${profile.user.email} now has ${formatHours(newHours)} allotted (${formatHours(remaining)} remaining).`,
  };
}
