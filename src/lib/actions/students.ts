"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { NOTIFICATION_TYPES, ROLES, USER_STATUS } from "@/lib/constants";
import { formatDate, formatHours } from "@/lib/format";
import {
  EMAIL_RE,
  normalizeEmail,
  parseDateField,
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
 * Register a LIST of student emails into a program (+ cohort where the
 * program has them), skipping the self-signup approval queue. Admin may
 * create anywhere; Dept Leader / Sales only inside their own program. Each
 * student confirms their full name and Telegram username on first sign-in;
 * hours are NOT granted here — an admin allocates them per mentor afterwards.
 * Emails may be separated by newlines, commas, semicolons, or spaces.
 * Already-registered and malformed entries are skipped and reported.
 */
export async function createStudents(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || !STAFF_ROLES.includes(actor.role)) {
    return { ok: false, error: "You aren't allowed to create students." };
  }

  const raw = String(formData.get("emails") ?? "");
  const entries = [...new Set(
    raw
      .split(/[\s,;]+/)
      .map((e) => normalizeEmail(e))
      .filter(Boolean)
  )];
  if (entries.length === 0) {
    return { ok: false, error: "Paste at least one email address." };
  }

  const invalid = entries.filter((e) => !EMAIL_RE.test(e));
  const valid = entries.filter((e) => EMAIL_RE.test(e));

  const enrollment = await resolveEnrollment(formData);
  if ("error" in enrollment) return { ok: false, error: enrollment.error };
  const { program, cohort } = enrollment;

  if (actor.role !== ROLES.ADMIN && program.id !== actor.programId) {
    return {
      ok: false,
      error: "You can only create students in your own program.",
    };
  }

  const existing = await prisma.user.findMany({
    where: { email: { in: valid } },
    select: { email: true },
  });
  const taken = new Set(existing.map((u) => u.email));
  const fresh = valid.filter((e) => !taken.has(e));

  await prisma.$transaction(async (tx) => {
    for (const email of fresh) {
      const studentUser = await tx.user.create({
        data: { email, role: ROLES.STUDENT, status: USER_STATUS.ACTIVE },
      });
      await tx.studentProfile.create({
        data: {
          userId: studentUser.id,
          programId: program.id,
          cohortId: cohort?.id ?? null,
          createdById: actor.id,
        },
      });
    }
  });

  const skipped = [
    ...[...taken].map((e) => `${e} (already registered)`),
    ...invalid.map((e) => `${e} (not a valid email)`),
  ];
  if (fresh.length === 0) {
    return {
      ok: false,
      error: `No students added. ${skipped.join(", ")}.`,
    };
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    message:
      `${fresh.length} student${fresh.length === 1 ? "" : "s"} added to ${enrollmentLabel(program.name, cohort?.name)}. ` +
      `They'll confirm their name and Telegram username when they first sign in.` +
      (skipped.length > 0 ? ` Skipped: ${skipped.join(", ")}.` : ""),
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
 * Move a student to a different cohort or program (admin correction for
 * mis-enrollments). Hour allocations and session history follow the student
 * untouched; the student is notified. Mentors visible to the student change
 * with the enrollment.
 */
export async function moveStudent(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can move students." };
  }

  const profileId = String(formData.get("studentProfileId") ?? "");
  const profile = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    include: { user: true, program: true, cohort: true },
  });
  if (!profile) return { ok: false, error: "Student not found." };

  const enrollment = await resolveEnrollment(formData);
  if ("error" in enrollment) return { ok: false, error: enrollment.error };
  const { program, cohort } = enrollment;

  if (
    program.id === profile.programId &&
    (cohort?.id ?? null) === profile.cohortId
  ) {
    return { ok: true, message: "No change: they're already enrolled there." };
  }

  const from = enrollmentLabel(profile.program.name, profile.cohort?.name);
  const to = enrollmentLabel(program.name, cohort?.name);

  await prisma.$transaction(async (tx) => {
    await tx.studentProfile.update({
      where: { id: profile.id },
      data: { programId: program.id, cohortId: cohort?.id ?? null },
    });
    await tx.notification.create({
      data: {
        userId: profile.userId,
        type: NOTIFICATION_TYPES.ENROLLMENT_MOVED,
        message: `Your enrollment was moved from ${from} to ${to}. Your hours and session history came with you.`,
      },
    });
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${profile.user.name ?? profile.user.email} moved from ${from} to ${to}.`,
  };
}

/**
 * Remove a student added by mistake (admin only). Blocked once any session
 * has been logged — at that point the record is history, not a typo; void
 * the sessions first if it truly must go.
 */
export async function deleteStudent(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can remove students." };
  }

  const profileId = String(formData.get("studentProfileId") ?? "");
  const profile = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    include: { user: true, _count: { select: { sessions: true } } },
  });
  if (!profile) return { ok: false, error: "Student not found." };
  if (profile._count.sessions > 0) {
    return {
      ok: false,
      error:
        "This student has logged sessions, so their record can't be deleted.",
    };
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
  redirect(`/admin/programs/${profile.programId}`);
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
 * only, always audited, always notifies the student), with an optional
 * deadline the hours should be used by — shown to the student and the
 * mentor; passing it flags the balance but never blocks. The student's total
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
  // "set" replaces the allocation; "add" tops it up by the entered amount.
  const mode = String(formData.get("mode") ?? "set");
  const parsed = parseHoursField(formData.get("hours"), {
    min: 0,
    label: "Allocated hours",
  });
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const enteredHours = parsed.value;

  const rawDeadline = String(formData.get("deadline") ?? "").trim();
  let deadline: Date | null = null;
  if (rawDeadline) {
    const parsedDeadline = parseDateField(rawDeadline);
    if ("error" in parsedDeadline) {
      return { ok: false, error: "Pick a valid deadline date." };
    }
    deadline = parsedDeadline.value;
  }

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
  const newHours =
    mode === "add" ? Number((oldHours + enteredHours).toFixed(2)) : enteredHours;
  const oldDeadline = existing?.deadline ?? null;
  const sameDeadline = (oldDeadline?.getTime() ?? null) === (deadline?.getTime() ?? null);
  if (newHours === oldHours && sameDeadline) {
    return { ok: true, message: "No change: allocation is already at that value." };
  }

  const mentorLabel = mentor.name ?? mentor.email;
  const deadlineNote = deadline ? ` They should be used by ${formatDate(deadline)}.` : "";
  await prisma.$transaction(async (tx) => {
    await tx.hourAllocation.upsert({
      where: { studentId_mentorId: { studentId: profile.id, mentorId } },
      update: {
        hours: newHours,
        deadline,
        // A new deadline restarts the reminder cycle.
        ...(sameDeadline ? {} : { deadlineStage: null }),
      },
      create: { studentId: profile.id, mentorId, hours: newHours, deadline },
    });
    if (newHours !== oldHours) {
      await tx.hourAllotmentChange.create({
        data: {
          studentId: profile.id,
          mentorId,
          changedById: actor.id,
          oldHours,
          newHours,
        },
      });
    }
    const delta = newHours - oldHours;
    await tx.notification.create({
      data: {
        userId: profile.userId,
        type: NOTIFICATION_TYPES.HOURS_GRANTED,
        message:
          delta > 0
            ? `You were granted ${formatHours(delta)} more hours with ${mentorLabel} (now ${formatHours(newHours)} with them).${deadlineNote}`
            : delta < 0
              ? `Your hours with ${mentorLabel} were adjusted from ${formatHours(oldHours)} to ${formatHours(newHours)}.${deadlineNote}`
              : `The deadline for your hours with ${mentorLabel} was ${deadline ? `set to ${formatDate(deadline)}` : "removed"}.`,
      },
    });
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${profile.user.email} now has ${formatHours(newHours)} hours with ${mentorLabel}${deadline ? `, to use by ${formatDate(deadline)}` : ""}.`,
  };
}
