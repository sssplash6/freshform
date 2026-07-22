"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  canActAsMentor,
  NOTIFICATION_TYPES,
  SESSION_STATUS,
  USER_STATUS,
} from "@/lib/constants";
import { formatDate, formatHours } from "@/lib/format";
import {
  parseDateField,
  parseHoursField,
  type ActionState,
} from "@/lib/actions/shared";

async function requireActiveMentor() {
  const actor = await getCurrentUser();
  if (!actor || !canActAsMentor(actor)) return null;
  if (actor.status !== USER_STATUS.ACTIVE) return null;
  return actor;
}

/** Remaining hours the student holds with this mentor (derived). */
async function remainingWith(
  studentProfileId: string,
  mentorId: string,
  allocatedHours: number
): Promise<number> {
  const sum = await prisma.session.aggregate({
    where: {
      studentId: studentProfileId,
      mentorId,
      status: SESSION_STATUS.ACTIVE,
    },
    _sum: { hours: true },
  });
  return allocatedHours - (sum._sum.hours ?? 0);
}

/**
 * Log a completed session. Draws down the hours the student holds with THIS
 * mentor (derived) and notifies them. Overdraw is allowed but flagged back
 * to the mentor.
 */
export async function logSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const mentor = await requireActiveMentor();
  if (!mentor) {
    return { ok: false, error: "Only assigned mentors can log sessions." };
  }

  const studentProfileId = String(formData.get("studentProfileId") ?? "");
  const hoursParsed = parseHoursField(formData.get("hours"), {
    min: 0.01,
    label: "Hours",
  });
  if ("error" in hoursParsed) return { ok: false, error: hoursParsed.error };
  const dateParsed = parseDateField(formData.get("date"));
  if ("error" in dateParsed) return { ok: false, error: dateParsed.error };
  const task = String(formData.get("task") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  // Unchecked "Student was present" box → no-show (still charged, tallied missed).
  const attended = formData.get("attended") != null;

  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    include: { user: true },
  });
  if (!profile) return { ok: false, error: "Student not found." };
  if (profile.user.status !== USER_STATUS.ACTIVE) {
    return {
      ok: false,
      error: "That student hasn't been approved by an admin yet.",
    };
  }

  // Sessions can only be logged against hours an admin allocated to THIS
  // mentor for this student.
  const allocation = await prisma.hourAllocation.findUnique({
    where: {
      studentId_mentorId: { studentId: profile.id, mentorId: mentor.id },
    },
  });
  if (!allocation) {
    return {
      ok: false,
      error:
        "No hours were allocated to you for that student. Ask an admin to allocate hours first.",
    };
  }

  // Deadlines are hard: once passed, the unused hours are forfeited and no
  // further sessions can be logged against this allocation.
  if (allocation.deadline.getTime() < Date.now()) {
    return {
      ok: false,
      error: `These hours expired on ${formatDate(allocation.deadline)} and can no longer be logged against. Ask an admin to extend the deadline or allocate new hours.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.session.create({
      data: {
        studentId: profile.id,
        mentorId: mentor.id,
        hours: hoursParsed.value,
        date: dateParsed.value,
        attended,
        task,
        note,
      },
    });
    await tx.notification.create({
      data: {
        userId: profile.userId,
        type: NOTIFICATION_TYPES.SESSION_LOGGED,
        message: attended
          ? `${mentor.name ?? mentor.email} logged a ${formatHours(hoursParsed.value)}-hour session on ${formatDate(dateParsed.value)}.`
          : `${mentor.name ?? mentor.email} recorded a ${formatHours(hoursParsed.value)}-hour no-show on ${formatDate(dateParsed.value)}. Those hours were still deducted.`,
      },
    });
  });

  revalidatePath("/", "layout");

  const remaining = await remainingWith(profile.id, mentor.id, allocation.hours);
  const studentLabel = profile.user.name ?? profile.user.email;
  const noShowNote = attended ? "" : " Recorded as a no-show.";
  return {
    ok: true,
    message:
      remaining < 0
        ? `Session logged.${noShowNote} Heads up: ${studentLabel} is now overdrawn by ${formatHours(-remaining)} hours with you.`
        : `Session logged.${noShowNote} ${studentLabel} has ${formatHours(remaining)} hours left with you.`,
  };
}

/** Load a session and verify the acting mentor logged it and it's ACTIVE. */
async function findOwnActiveSession(mentorId: string, sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { student: { include: { user: true } } },
  });
  if (!session || session.mentorId !== mentorId) return null;
  if (session.status !== SESSION_STATUS.ACTIVE) return null;
  return session;
}

/**
 * Edit a session the mentor logged in error (hours/date/task/note). The hour
 * delta flows through derived totals; the student is notified.
 */
export async function editSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const mentor = await requireActiveMentor();
  if (!mentor) {
    return { ok: false, error: "Only mentors can edit their sessions." };
  }

  const sessionId = String(formData.get("sessionId") ?? "");
  const session = await findOwnActiveSession(mentor.id, sessionId);
  if (!session) {
    return {
      ok: false,
      error: "You can only edit active sessions you logged yourself.",
    };
  }

  const hoursParsed = parseHoursField(formData.get("hours"), {
    min: 0.01,
    label: "Hours",
  });
  if ("error" in hoursParsed) return { ok: false, error: hoursParsed.error };
  const dateParsed = parseDateField(formData.get("date"));
  if ("error" in dateParsed) return { ok: false, error: dateParsed.error };
  const task = String(formData.get("task") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const attended = formData.get("attended") != null;

  const attendanceChanged = attended !== session.attended;
  const attendanceNote = attendanceChanged
    ? attended
      ? " Now marked as attended."
      : " Now marked as a no-show."
    : "";
  await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: session.id },
      data: {
        hours: hoursParsed.value,
        date: dateParsed.value,
        attended,
        task,
        note,
      },
    });
    await tx.notification.create({
      data: {
        userId: session.student.userId,
        type: NOTIFICATION_TYPES.SESSION_EDITED,
        message: `${mentor.name ?? mentor.email} corrected a session: now ${formatHours(hoursParsed.value)} hours on ${formatDate(dateParsed.value)} (was ${formatHours(session.hours)} on ${formatDate(session.date)}).${attendanceNote}`,
      },
    });
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Session updated." };
}

/** Void a session the mentor logged in error — returns the hours. */
export async function voidSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const mentor = await requireActiveMentor();
  if (!mentor) {
    return { ok: false, error: "Only mentors can void their sessions." };
  }

  const sessionId = String(formData.get("sessionId") ?? "");
  const session = await findOwnActiveSession(mentor.id, sessionId);
  if (!session) {
    return {
      ok: false,
      error: "You can only void active sessions you logged yourself.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: session.id },
      data: { status: SESSION_STATUS.VOIDED },
    });
    await tx.notification.create({
      data: {
        userId: session.student.userId,
        type: NOTIFICATION_TYPES.SESSION_VOIDED,
        message: `${mentor.name ?? mentor.email} voided the ${formatHours(session.hours)}-hour session from ${formatDate(session.date)}. Those hours are back in your balance.`,
      },
    });
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Session voided; hours returned." };
}
