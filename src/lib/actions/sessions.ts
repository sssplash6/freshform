"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  NOTIFICATION_TYPES,
  ROLES,
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
  if (!actor || actor.role !== ROLES.MENTOR) return null;
  if (actor.status !== USER_STATUS.ACTIVE) return null;
  return actor;
}

async function remainingFor(studentProfileId: string): Promise<number> {
  const profile = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: studentProfileId },
  });
  const sum = await prisma.session.aggregate({
    where: { studentId: studentProfileId, status: SESSION_STATUS.ACTIVE },
    _sum: { hours: true },
  });
  return profile.allottedHours - (sum._sum.hours ?? 0);
}

/**
 * Log a completed session. Draws down the student's remaining hours (derived)
 * and notifies them. Overdraw is allowed but flagged back to the mentor.
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
  const note = String(formData.get("note") ?? "").trim() || null;

  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    include: { user: true },
  });
  if (!profile) return { ok: false, error: "Student not found." };

  // The student must be in one of THIS mentor's assigned cohorts.
  const assignment = await prisma.mentorAssignment.findUnique({
    where: {
      mentorId_cohortId: { mentorId: mentor.id, cohortId: profile.cohortId },
    },
  });
  if (!assignment) {
    return {
      ok: false,
      error: "That student isn't in any of your assigned cohorts.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.session.create({
      data: {
        studentId: profile.id,
        mentorId: mentor.id,
        hours: hoursParsed.value,
        date: dateParsed.value,
        note,
      },
    });
    await tx.notification.create({
      data: {
        userId: profile.userId,
        type: NOTIFICATION_TYPES.SESSION_LOGGED,
        message: `${mentor.name ?? mentor.email} logged a ${formatHours(hoursParsed.value)}-hour session on ${formatDate(dateParsed.value)}.`,
      },
    });
  });

  revalidatePath("/", "layout");

  const remaining = await remainingFor(profile.id);
  return {
    ok: true,
    message:
      remaining < 0
        ? `Session logged. Heads up: ${profile.user.name ?? profile.user.email} is now overdrawn by ${formatHours(-remaining)} hours.`
        : `Session logged. ${profile.user.name ?? profile.user.email} has ${formatHours(remaining)} hours remaining.`,
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
 * Edit a session the mentor logged in error (hours/date/note). The hour
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
  const note = String(formData.get("note") ?? "").trim() || null;

  await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: session.id },
      data: {
        hours: hoursParsed.value,
        date: dateParsed.value,
        note,
      },
    });
    await tx.notification.create({
      data: {
        userId: session.student.userId,
        type: NOTIFICATION_TYPES.SESSION_EDITED,
        message: `${mentor.name ?? mentor.email} corrected a session: now ${formatHours(hoursParsed.value)} hours on ${formatDate(dateParsed.value)} (was ${formatHours(session.hours)} on ${formatDate(session.date)}).`,
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
        message: `${mentor.name ?? mentor.email} voided the ${formatHours(session.hours)}-hour session from ${formatDate(session.date)} — those hours are back in your balance.`,
      },
    });
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Session voided; hours returned." };
}
