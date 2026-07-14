"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { NOTIFICATION_TYPES, ROLES, USER_STATUS } from "@/lib/constants";
import { formatHours } from "@/lib/format";
import {
  EMAIL_RE,
  normalizeEmail,
  parseHoursField,
  type ActionState,
} from "@/lib/actions/shared";
import type { Cohort, Program } from "@/generated/prisma/client";

const STAFF_ROLES: string[] = [ROLES.ADMIN, ROLES.DEPT_LEADER, ROLES.SALES];

/** "Program" or "Program / Cohort" display label. */
function enrollmentLabel(programName: string, cohortName?: string | null) {
  return cohortName ? `${programName} / ${cohortName}` : programName;
}

const TELEGRAM_RE = /^[A-Za-z0-9_]{5,32}$/;

/**
 * Normalize a Telegram username field ("@name" or "name"). Returns the bare
 * username or an error message.
 */
function parseTelegramField(
  raw: FormDataEntryValue | null
): { value: string } | { error: string } {
  const value = String(raw ?? "")
    .trim()
    .replace(/^@/, "");
  if (!TELEGRAM_RE.test(value)) {
    return {
      error:
        "Enter your Telegram username (5–32 letters, digits or underscores).",
    };
  }
  return { value };
}

/**
 * Resolve the program (+ cohort, required only in programs that have
 * cohorts) submitted by an enrollment form.
 */
async function resolveEnrollment(
  formData: FormData
): Promise<
  | { error: string }
  | { program: Program; cohort: Cohort | null }
> {
  const programId = String(formData.get("programId") ?? "");
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: { cohorts: true },
  });
  if (!program) return { error: "Pick a program." };

  if (program.cohorts.length === 0) return { program, cohort: null };

  const cohortId = String(formData.get("cohortId") ?? "");
  const cohort = program.cohorts.find((c) => c.id === cohortId);
  if (!cohort) return { error: `Pick a cohort in ${program.name}.` };
  return { program, cohort };
}

/**
 * Register a student's email into a program (+ cohort where the program has
 * them), skipping the self-signup approval queue. Admin may create anywhere;
 * Dept Leader / Sales only inside their own program. The student completes
 * their profile (full name, Telegram username) on first sign-in; hours are
 * NOT granted here — an admin allocates them per mentor afterwards.
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

  const enrollment = await resolveEnrollment(formData);
  if ("error" in enrollment) return { ok: false, error: enrollment.error };
  const { program, cohort } = enrollment;

  if (actor.role !== ROLES.ADMIN && program.id !== actor.programId) {
    return {
      ok: false,
      error: "You can only create students in your own program.",
    };
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
    await tx.studentProfile.create({
      data: {
        userId: studentUser.id,
        programId: program.id,
        cohortId: cohort?.id ?? null,
        createdById: actor.id,
      },
    });
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Student ${email} created in ${enrollmentLabel(program.name, cohort?.name)}. They'll confirm their name and Telegram username when they first sign in.`,
  };
}

/**
 * First sign-in step for staff-registered students: confirm full name and
 * Telegram username, completing the profile the staff member created.
 */
export async function completeStudentProfile(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.STUDENT) {
    return { ok: false, error: "Only students can complete this step." };
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: actor.id },
  });
  if (!profile) {
    return { ok: false, error: "Complete your registration first." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Enter your full name." };

  const telegram = parseTelegramField(formData.get("telegramUsername"));
  if ("error" in telegram) return { ok: false, error: telegram.error };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { name } });
    await tx.studentProfile.update({
      where: { id: profile.id },
      data: { telegramUsername: telegram.value },
    });
  });

  revalidatePath("/", "layout");
  redirect("/student");
}

/**
 * Self-signup step 2 (fallback for emails staff didn't pre-register): a
 * PENDING student picks their program (+ cohort where the program has them)
 * and confirms their name and Telegram username. Creates the profile and
 * notifies every admin that an approval is waiting.
 */
export async function completeOnboarding(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.STUDENT) {
    return { ok: false, error: "Only students can complete onboarding." };
  }

  const existingProfile = await prisma.studentProfile.findUnique({
    where: { userId: actor.id },
  });
  if (existingProfile) {
    return { ok: false, error: "Your registration is already submitted." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Enter your full name." };

  const telegram = parseTelegramField(formData.get("telegramUsername"));
  if ("error" in telegram) return { ok: false, error: telegram.error };

  const enrollment = await resolveEnrollment(formData);
  if ("error" in enrollment) return { ok: false, error: enrollment.error };
  const { program, cohort } = enrollment;

  const admins = await prisma.user.findMany({
    where: { role: ROLES.ADMIN },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.id },
      data: { name },
    });
    await tx.studentProfile.create({
      data: {
        userId: actor.id,
        programId: program.id,
        cohortId: cohort?.id ?? null,
        telegramUsername: telegram.value,
        createdById: actor.id,
      },
    });
    await tx.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: NOTIFICATION_TYPES.STUDENT_SIGNUP,
        message: `${name} (${actor.email}) signed up for ${enrollmentLabel(program.name, cohort?.name)} and is awaiting approval.`,
      })),
    });
  });

  revalidatePath("/", "layout");
  redirect("/student");
}

/**
 * Approve a self-signed-up student (admin only). Activates the account;
 * hours are allocated separately, per mentor.
 */
export async function approveStudent(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can approve students." };
  }

  const profileId = String(formData.get("studentProfileId") ?? "");
  const profile = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    include: { user: true, program: true, cohort: true },
  });
  if (!profile) return { ok: false, error: "Student not found." };
  if (profile.user.status !== USER_STATUS.PENDING) {
    return { ok: true, message: "This student is already approved." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: profile.userId },
      data: { status: USER_STATUS.ACTIVE },
    });
    await tx.notification.create({
      data: {
        userId: profile.userId,
        type: NOTIFICATION_TYPES.ACCOUNT_APPROVED,
        message: `Your registration for ${enrollmentLabel(profile.program.name, profile.cohort?.name)} was approved. You'll be notified as mentor hours are allocated to you.`,
      },
    });
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${profile.user.name ?? profile.user.email} approved. Now allocate their mentor hours.`,
  };
}

/**
 * Reject (delete) a PENDING self-signup — e.g. an unknown person or a typo
 * account. Only possible while nothing references the student yet.
 */
export async function rejectStudent(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can reject students." };
  }

  const profileId = String(formData.get("studentProfileId") ?? "");
  const profile = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    include: { user: true, _count: { select: { sessions: true } } },
  });
  if (!profile) return { ok: false, error: "Student not found." };
  if (profile.user.status !== USER_STATUS.PENDING) {
    return { ok: false, error: "Only pending students can be rejected." };
  }
  if (profile._count.sessions > 0) {
    return { ok: false, error: "This student already has logged sessions." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.hourAllotmentChange.deleteMany({ where: { studentId: profile.id } });
    await tx.hourAllocation.deleteMany({ where: { studentId: profile.id } });
    await tx.mentorFeedback.deleteMany({ where: { studentId: profile.id } });
    await tx.websiteFeedback.deleteMany({ where: { studentId: profile.id } });
    await tx.notification.deleteMany({ where: { userId: profile.userId } });
    await tx.studentProfile.delete({ where: { id: profile.id } });
    await tx.user.delete({ where: { id: profile.userId } });
  });

  revalidatePath("/", "layout");
  return { ok: true, message: `${profile.user.email} rejected and removed.` };
}

/**
 * Set the hours a student holds with ONE mentor (spec §3 key rule: admin
 * only, always audited, always notifies the student). The student's total
 * allotment is derived as the sum of these allocations; sessions logged by
 * the mentor draw the allocation down toward 0.
 */
export async function setMentorAllocation(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can change hour allocations." };
  }

  const profileId = String(formData.get("studentProfileId") ?? "");
  const mentorId = String(formData.get("mentorId") ?? "");
  const parsed = parseHoursField(formData.get("hours"), {
    min: 0,
    label: "Allocated hours",
  });
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const newHours = parsed.value;

  const profile = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    include: { user: true },
  });
  if (!profile) return { ok: false, error: "Student not found." };

  const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
  if (!mentor || mentor.role !== ROLES.MENTOR) {
    return { ok: false, error: "Pick a mentor." };
  }

  // The mentor must work in the student's program (assigned program-wide or
  // to any of its cohorts) — hours can only be granted from mentors within
  // the program.
  const inProgram = await prisma.mentorAssignment.findFirst({
    where: { mentorId, programId: profile.programId },
  });
  if (!inProgram) {
    return {
      ok: false,
      error: "That mentor isn't assigned to the student's program.",
    };
  }

  const existing = await prisma.hourAllocation.findUnique({
    where: { studentId_mentorId: { studentId: profile.id, mentorId } },
  });
  const oldHours = existing?.hours ?? 0;
  if (newHours === oldHours) {
    return { ok: true, message: "No change: allocation is already at that value." };
  }

  const mentorLabel = mentor.name ?? mentor.email;
  await prisma.$transaction(async (tx) => {
    await tx.hourAllocation.upsert({
      where: { studentId_mentorId: { studentId: profile.id, mentorId } },
      update: { hours: newHours },
      create: { studentId: profile.id, mentorId, hours: newHours },
    });
    await tx.hourAllotmentChange.create({
      data: {
        studentId: profile.id,
        mentorId,
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
            ? `You were granted ${formatHours(delta)} more hours with ${mentorLabel} (now ${formatHours(newHours)} with them).`
            : `Your hours with ${mentorLabel} were adjusted from ${formatHours(oldHours)} to ${formatHours(newHours)}.`,
      },
    });
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${profile.user.email} now has ${formatHours(newHours)} hours with ${mentorLabel}.`,
  };
}
