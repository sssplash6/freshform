"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { notify, notificationHref } from "@/lib/notify";
import {
  ASSIGNMENT_PROGRESS,
  canActAsMentor,
  NOTIFICATION_TYPES,
  ROLES,
  USER_STATUS,
} from "@/lib/constants";
import { MASTERS_PROGRAM_NAME } from "../../../config/app-config";
import { formatDate, formatHours, formatMoney } from "@/lib/format";
import { syncGoalProgress } from "@/lib/goal-progress";
import { parseTaskField } from "@/lib/tasks";
import {
  EMAIL_RE,
  normalizeEmail,
  parseDateField,
  parseHoursField,
  parseLinkField,
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
 * An optional student-folder link per row is stored for their mentors to open.
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

  // One (email, name, folder link) triple per row, index-aligned with the
  // emails. Name and folder link are both optional — a blank name is filled
  // in by the student on first sign-in, and a folder can be attached later.
  const emails = formData.getAll("email").map((e) => normalizeEmail(e));
  const names = formData.getAll("name").map((n) => String(n ?? "").trim());
  const folderUrls = formData.getAll("folderUrl");
  const seen = new Set<string>();
  const rows = emails
    .map((email, i) => ({ email, name: names[i] ?? "", rawFolder: folderUrls[i] ?? null }))
    .filter((r) => r.email && !seen.has(r.email) && (seen.add(r.email), true));
  if (rows.length === 0) {
    return { ok: false, error: "Enter at least one student email." };
  }

  // A malformed link fails the whole submission rather than being dropped
  // silently — losing a file link without saying so is worse than a retry.
  const withFolders: { email: string; name: string; folderUrl: string | null }[] = [];
  for (const r of rows) {
    const link = parseLinkField(r.rawFolder, `The folder link for ${r.email}`);
    if ("error" in link) return { ok: false, error: link.error };
    withFolders.push({ email: r.email, name: r.name, folderUrl: link.value });
  }

  const invalid = withFolders
    .filter((r) => !EMAIL_RE.test(r.email))
    .map((r) => r.email);
  const valid = withFolders.filter((r) => EMAIL_RE.test(r.email));

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
    where: { email: { in: valid.map((r) => r.email) } },
    select: { email: true },
  });
  const taken = new Set(existing.map((u) => u.email));
  const fresh = valid.filter((r) => !taken.has(r.email));

  await prisma.$transaction(async (tx) => {
    for (const { email, name, folderUrl } of fresh) {
      const studentUser = await tx.user.create({
        data: {
          email,
          name: name || null,
          role: ROLES.STUDENT,
          status: USER_STATUS.ACTIVE,
        },
      });
      await tx.studentProfile.create({
        data: {
          userId: studentUser.id,
          programId: program.id,
          cohortId: cohort?.id ?? null,
          folderUrl,
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
 * Attach, replace, or clear a student's folder link after registration — for
 * students added before a folder existed, or when it moves. Same
 * permissions as creating the student: admin anywhere, Dept Leader / Sales
 * only within their own program. Submitting an empty field removes the link.
 */
export async function setStudentFolder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || !STAFF_ROLES.includes(actor.role)) {
    return { ok: false, error: "You aren't allowed to edit student folders." };
  }

  const profileId = String(formData.get("studentProfileId") ?? "");
  const profile = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    include: { user: true },
  });
  if (!profile) return { ok: false, error: "Student not found." };

  if (actor.role !== ROLES.ADMIN && profile.programId !== actor.programId) {
    return {
      ok: false,
      error: "You can only edit students in your own program.",
    };
  }

  const link = parseLinkField(formData.get("folderUrl"), "The folder link");
  if ("error" in link) return { ok: false, error: link.error };
  if (link.value === profile.folderUrl) {
    return { ok: true, message: "No change: that's already the folder link." };
  }

  await prisma.studentProfile.update({
    where: { id: profile.id },
    data: { folderUrl: link.value },
  });

  revalidatePath("/", "layout");
  const who = profile.user.name ?? profile.user.email;
  return {
    ok: true,
    message: link.value
      ? `Folder link saved for ${who} — their mentors can open it now.`
      : `Folder link removed for ${who}.`,
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
    const created = await tx.studentProfile.create({
      data: {
        userId: actor.id,
        programId: program.id,
        cohortId: cohort?.id ?? null,
        telegramUsername: telegram.value,
        createdById: actor.id,
      },
    });
    await notify(tx, {
      to: admins.map((admin) => admin.id),
      type: NOTIFICATION_TYPES.STUDENT_SIGNUP,
      actorId: actor.id,
      // Straight at the approval screen: a signup that needs approving should
      // be one click from the notice, not a search away.
      href: notificationHref.adminStudent(created.id),
      message: `${name} (${actor.email}) signed up for ${enrollmentLabel(program.name, cohort?.name)} and is awaiting approval.`,
    });
  });

  revalidatePath("/", "layout");
  redirect("/student");
}

/**
 * Correct the email a student signs in with (admin only). Their account, hours
 * and history all stay put — only the address changes. This is what makes an
 * imported student real: the tracking spreadsheet held no emails, so students
 * brought over from it carry a placeholder until someone fills the real one in,
 * and until then they cannot sign in at all.
 */
export async function setStudentEmail(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can change a student's email." };
  }

  const profileId = String(formData.get("studentProfileId") ?? "");
  const profile = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    include: { user: true },
  });
  if (!profile) return { ok: false, error: "Student not found." };

  const email = normalizeEmail(formData.get("email"));
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (email === profile.user.email) {
    return { ok: true, message: "No change: that's already their address." };
  }
  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken) {
    return { ok: false, error: `${email} already has an account.` };
  }

  // A real address means the weekly hours email can reach them, so it goes back
  // to the app's default. A placeholder had it switched off on the way in.
  const reachable = !email.endsWith("@import.invalid");
  await prisma.user.update({
    where: { id: profile.userId },
    data: { email, ...(reachable ? { weeklyDigest: true } : {}) },
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${profile.user.name ?? "This student"} now signs in with ${email}.`,
  };
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
    await notify(tx, {
      to: [profile.userId],
      type: NOTIFICATION_TYPES.ENROLLMENT_MOVED,
      actorId: actor.id,
      href: notificationHref.studentHome(),
      message: `Your enrollment was moved from ${from} to ${to}. Your hours and session history came with you.`,
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
    // The tasks their hours bought. Nothing was logged against them (no
    // sessions, checked above), so no delivered hours are at stake.
    await tx.assignment.deleteMany({ where: { studentId: profile.id } });
    await tx.mentorFeedback.deleteMany({ where: { studentId: profile.id } });
    await tx.websiteFeedback.deleteMany({ where: { studentId: profile.id } });
    await tx.notification.deleteMany({ where: { userId: profile.userId } });
    await tx.studentProfile.delete({ where: { id: profile.id } });
    await tx.user.delete({ where: { id: profile.userId } });
  });

  revalidatePath("/", "layout");
  redirect(`/admin/programs/${profile.programId}/students`);
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
    await notify(tx, {
      to: [profile.userId],
      type: NOTIFICATION_TYPES.ACCOUNT_APPROVED,
      actorId: actor.id,
      href: notificationHref.studentHome(),
      message: `Your registration for ${enrollmentLabel(profile.program.name, profile.cohort?.name)} was approved. You'll be notified as mentor hours are allocated to you.`,
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
    await tx.assignment.deleteMany({ where: { studentId: profile.id } });
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
 * only, always audited, always notifies the student), with the required
 * deadline the hours must be used by — once it passes, unused hours are
 * forfeited. The student's total allotment is derived as the sum of these
 * allocations; sessions logged by the mentor draw the allocation down toward 0.
 *
 * GRANTING hours also names the TASK they are for, and that is not optional: it
 * becomes the mentor's piece of work with these hours as its budget, and every
 * session they log has to be logged against one of the student's tasks. Naming
 * a task that is already open tops its budget up rather than adding a second row
 * with the same name. Corrections — a mistyped total, a new deadline, an amount
 * paid — need no task, since they grant nothing.
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
  // "set" replaces the allocation (a correction); "add" grants more hours on top
  // of whatever the student already holds with this mentor.
  const mode = String(formData.get("mode") ?? "set");
  const parsed = parseHoursField(formData.get("hours"), {
    min: 0,
    label: "Allocated hours",
  });
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const enteredHours = parsed.value;

  // Deadlines are required: once one passes, unused hours are forfeited.
  const parsedDeadline = parseDateField(formData.get("deadline"));
  if ("error" in parsedDeadline) {
    return { ok: false, error: "Pick a deadline for these hours." };
  }
  const enteredDeadline = parsedDeadline.value;

  const profile = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    include: { user: true, program: true },
  });
  if (!profile) return { ok: false, error: "Student not found." };

  // Master's Program allocations also record how much the student paid.
  const isMasters = profile.program.name === MASTERS_PROGRAM_NAME;
  let enteredPaid: number | null = null;
  if (isMasters) {
    const raw = String(formData.get("amountPaid") ?? "").trim();
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "Enter the amount paid (a number of 0 or more)." };
    }
    if (n > 10_000_000) {
      return { ok: false, error: "Amount paid is implausibly large." };
    }
    enteredPaid = Number(n.toFixed(2));
  }

  const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
  if (!mentor || !canActAsMentor(mentor)) {
    return { ok: false, error: "Pick a mentor." };
  }

  // Hours are granted from mentors within the student's program. If the
  // mentor isn't in the program yet (admin adding a fresh mentor to the
  // student), assign them program-wide as part of this action.
  const inProgram = await prisma.mentorAssignment.findFirst({
    where: { mentorId, programId: profile.programId },
  });

  const existing = await prisma.hourAllocation.findUnique({
    where: { studentId_mentorId: { studentId: profile.id, mentorId } },
  });
  const oldHours = existing?.hours ?? 0;
  const newHours =
    mode === "add" ? Number((oldHours + enteredHours).toFixed(2)) : enteredHours;
  const granted = Number((newHours - oldHours).toFixed(2));

  // Every grant from one mentor lands in the same pool, which has one use-by
  // date, so topping up keeps whichever date is LATER: hours already granted
  // must never be quietly shortened by a top-up aimed at nearer work. The task
  // records the date this particular grant was aimed at.
  const deadline =
    mode === "add" && existing && existing.deadline > enteredDeadline
      ? existing.deadline
      : enteredDeadline;
  const oldDeadline = existing?.deadline ?? null;
  const sameDeadline = oldDeadline?.getTime() === deadline.getTime();

  // Money follows the hours: "add" records another payment on top of the total
  // already banked, "set" states the total outright. Non-Master's never touch it.
  const oldPaid = existing?.amountPaid ?? null;
  const newPaid = !isMasters
    ? null
    : mode === "add" && existing
      ? Number(((oldPaid ?? 0) + (enteredPaid ?? 0)).toFixed(2))
      : enteredPaid;
  const sameAmount = !isMasters || oldPaid === newPaid;

  if (newHours === oldHours && sameDeadline && sameAmount) {
    return { ok: true, message: "No change: allocation is already at that value." };
  }

  // Hours arriving means work arriving, so the grant says what the work is.
  let task: string | null = null;
  if (granted > 0) {
    const parsedTask = parseTaskField(
      formData.get("task"),
      formData.get("taskCustom")
    );
    if ("error" in parsedTask) return { ok: false, error: parsedTask.error };
    task = parsedTask.value;
  }

  const mentorLabel = mentor.name ?? mentor.email;
  const studentName = profile.user.name ?? profile.user.email;
  const deadlineNote = ` They must be used by ${formatDate(deadline)}.`;

  const taskOutcome = await prisma.$transaction(async (tx) => {
    // Bring the mentor into the program if they weren't already.
    if (!inProgram) {
      await tx.mentorAssignment.create({
        data: { mentorId, programId: profile.programId, cohortId: null },
      });
      await notify(tx, {
        to: [mentorId],
        type: NOTIFICATION_TYPES.MENTOR_ASSIGNED,
        actorId: actor.id,
        href: notificationHref.mentorHome(),
        message: `You were assigned to ${profile.program.name}. Set your booking link on your mentor page so students there can book you.`,
      });
    }
    await tx.hourAllocation.upsert({
      where: { studentId_mentorId: { studentId: profile.id, mentorId } },
      update: {
        hours: newHours,
        deadline,
        // A new deadline restarts the reminder cycle.
        ...(sameDeadline ? {} : { deadlineStage: null }),
        ...(isMasters ? { amountPaid: newPaid } : {}),
      },
      create: {
        studentId: profile.id,
        mentorId,
        hours: newHours,
        deadline,
        ...(isMasters ? { amountPaid: newPaid } : {}),
      },
    });

    // The task these hours bought. Topping up an open one keeps the plan honest:
    // a second "Supplemental Essays" row would split the same work in two.
    let outcome: { task: string; budget: number; created: boolean } | null = null;
    if (task) {
      const open = await tx.assignment.findFirst({
        where: {
          studentId: profile.id,
          mentorId,
          purpose: task,
          progress: { not: ASSIGNMENT_PROGRESS.DONE },
        },
        orderBy: { position: "asc" },
      });
      if (open) {
        const budget = Number(((open.hourLimit ?? 0) + granted).toFixed(2));
        await tx.assignment.update({
          where: { id: open.id },
          data: { hourLimit: budget },
        });
        // A raised budget can reopen work the old limit had finished.
        await syncGoalProgress(tx, open.id);
        outcome = { task, budget, created: false };
      } else {
        const last = await tx.assignment.findFirst({
          where: { studentId: profile.id },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        await tx.assignment.create({
          data: {
            studentId: profile.id,
            mentorId,
            purpose: task,
            hourLimit: granted,
            // The date THIS grant was aimed at, which the pooled use-by date can
            // outlive once other hours are added to the same mentor.
            timeline: formatDate(enteredDeadline),
            position: (last?.position ?? -1) + 1,
            createdById: actor.id,
          },
        });
        outcome = { task, budget: granted, created: true };
        await notify(tx, {
          to: [mentorId],
          type: NOTIFICATION_TYPES.GOAL_ASSIGNED,
          actorId: actor.id,
          href: notificationHref.mentorStudent(profile.id),
          message: `New task for ${studentName}: "${task}", budgeted ${formatHours(granted)} hours to use by ${formatDate(enteredDeadline)}. Log your sessions against it.`,
        });
      }
    }

    if (newHours !== oldHours) {
      const forTask = task ? ` for "${task}"` : "";
      await notify(tx, {
        to: [mentorId],
        type: NOTIFICATION_TYPES.HOURS_GRANTED,
        actorId: actor.id,
        href: notificationHref.mentorStudent(profile.id),
        message: `Your hours with ${studentName} are now ${formatHours(newHours)} (was ${formatHours(oldHours)})${forTask}, to use by ${formatDate(deadline)}.`,
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
    }

    await notify(tx, {
      to: [profile.userId],
      type: NOTIFICATION_TYPES.HOURS_GRANTED,
      actorId: actor.id,
      href: notificationHref.studentHome(),
      message:
        granted > 0
          ? `You were granted ${formatHours(granted)} more hours with ${mentorLabel} for "${task}" (now ${formatHours(newHours)} with them).${deadlineNote}`
          : granted < 0
            ? `Your hours with ${mentorLabel} were adjusted from ${formatHours(oldHours)} to ${formatHours(newHours)}.${deadlineNote}`
            : `The deadline for your hours with ${mentorLabel} was updated to ${formatDate(deadline)}.`,
    });

    return outcome;
  });

  revalidatePath("/", "layout");
  const paidNote =
    isMasters && newPaid !== null ? ` · ${formatMoney(newPaid)} paid` : "";
  const taskNote = taskOutcome
    ? taskOutcome.created
      ? ` "${taskOutcome.task}" is now on ${mentorLabel}'s list, budgeted ${formatHours(taskOutcome.budget)} hours.`
      : ` "${taskOutcome.task}" is now budgeted ${formatHours(taskOutcome.budget)} hours.`
    : "";
  return {
    ok: true,
    message: `${profile.user.email} now has ${formatHours(newHours)} hours with ${mentorLabel}, to use by ${formatDate(deadline)}${paidNote}.${taskNote}`,
  };
}

/**
 * Remove a mentor from a student — deletes that per-mentor allocation, the tasks
 * those hours bought, and the audit rows (admin only, student notified). Blocked
 * once a session has been logged with the mentor: those hours were delivered and
 * are history, not a mistake to erase. The mentor keeps their program
 * assignment.
 */
export async function removeMentorAllocation(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can remove a mentor's hours." };
  }

  const profileId = String(formData.get("studentProfileId") ?? "");
  const mentorId = String(formData.get("mentorId") ?? "");

  const allocation = await prisma.hourAllocation.findUnique({
    where: { studentId_mentorId: { studentId: profileId, mentorId } },
    include: { student: { include: { user: true } }, mentor: true },
  });
  if (!allocation) {
    return { ok: false, error: "That mentor isn't allocated to this student." };
  }

  const sessionCount = await prisma.session.count({
    where: { studentId: profileId, mentorId },
  });
  if (sessionCount > 0) {
    return {
      ok: false,
      error:
        "This mentor has logged sessions with the student, so their hours can't be removed. Void the sessions first if it must go.",
    };
  }

  const mentorLabel = allocation.mentor.name ?? allocation.mentor.email;
  await prisma.$transaction(async (tx) => {
    await tx.hourAllotmentChange.deleteMany({
      where: { studentId: profileId, mentorId },
    });
    // Their tasks go with their hours: nothing was logged against them (no
    // sessions, checked above), and a task nobody holds hours for is a line the
    // mentor can't act on.
    await tx.assignment.deleteMany({ where: { studentId: profileId, mentorId } });
    await tx.hourAllocation.delete({
      where: { studentId_mentorId: { studentId: profileId, mentorId } },
    });
    await notify(tx, {
      to: [allocation.student.userId],
      type: NOTIFICATION_TYPES.HOURS_GRANTED,
      actorId: actor.id,
      href: notificationHref.studentHome(),
      message: `Your hours with ${mentorLabel} were removed. They're no longer one of your mentors.`,
    });
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${mentorLabel} removed from this student, along with the tasks their hours were for.`,
  };
}
