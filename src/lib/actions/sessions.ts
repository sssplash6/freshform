"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  ATTENDANCE,
  ATTENDANCE_META,
  attendanceFields,
  attendanceOf,
  canActAsMentor,
  NOTIFICATION_TYPES,
  SESSION_STATUS,
  USER_STATUS,
} from "@/lib/constants";
import { formatDate, formatHours } from "@/lib/format";
import { syncGoalProgress } from "@/lib/goal-progress";
import { adminIds, notify, notificationHref } from "@/lib/notify";
import {
  parseDateField,
  parseHoursField,
  type ActionState,
} from "@/lib/actions/shared";

/**
 * Which of the four kinds of meeting this was. Defaults to Attended, so a form
 * that somehow arrives without the field records the ordinary case rather than
 * failing — and an unknown value is never written.
 */
function readAttendance(raw: FormDataEntryValue | null): string {
  const value = String(raw ?? "").trim().toUpperCase();
  return value in ATTENDANCE_META ? value : ATTENDANCE.ATTENDED;
}

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
 * Resolve the task a session is being logged against. Required: a mentor says
 * which piece of work the meeting went toward, so planned hours can be read
 * against delivered ones. It must be one of the tasks an admin gave THIS mentor
 * for THIS student — a mentor cannot log time against a colleague's task, or
 * against another student's.
 */
async function resolveGoal(
  raw: FormDataEntryValue | null,
  studentProfileId: string,
  mentorId: string
): Promise<{ id: string; purpose: string } | { error: string }> {
  const id = String(raw ?? "").trim();
  if (!id) {
    return {
      error:
        "Pick the task this session worked on. If none of them fit, ask an admin to allocate hours for the right task.",
    };
  }
  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (
    !assignment ||
    assignment.studentId !== studentProfileId ||
    assignment.mentorId !== mentorId
  ) {
    return { error: "That task isn't one of yours for this student." };
  }
  return { id: assignment.id, purpose: assignment.purpose };
}

/**
 * Log a completed session against one of the mentor's open tasks for the
 * student. Draws down the hours the student holds with THIS mentor (derived) and
 * notifies them. Overdraw is allowed but flagged back to the mentor.
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
  const state = readAttendance(formData.get("attendance"));
  const fields = attendanceFields(state);
  const rescheduled = state === ATTENDANCE.RESCHEDULED;

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
  // further sessions can be logged against this allocation. A rescheduled
  // meeting charges nothing, but recording one against expired hours would still
  // be recording work on a pool that is closed.
  if (allocation.deadline.getTime() < Date.now()) {
    return {
      ok: false,
      error: `These hours expired on ${formatDate(allocation.deadline)} and can no longer be logged against. Ask an admin to extend the deadline or allocate new hours.`,
    };
  }

  // Checked after the allocation, so a mentor with no hours for this student
  // hears about that first rather than being asked to pick a task they can't use.
  const goal = await resolveGoal(
    formData.get("assignmentId"),
    profile.id,
    mentor.id
  );
  if ("error" in goal) return { ok: false, error: goal.error };

  const staff = await adminIds();
  const mentorLabel = mentor.name ?? mentor.email;
  const studentName = profile.user.name ?? profile.user.email;

  const sync = await prisma.$transaction(async (tx) => {
    await tx.session.create({
      data: {
        studentId: profile.id,
        mentorId: mentor.id,
        assignmentId: goal.id,
        hours: hoursParsed.value,
        date: dateParsed.value,
        note,
        ...fields,
      },
    });

    // Progress follows the hours: this may move the task to In progress, or
    // finish it outright if the logged total reached its limit.
    const synced = await syncGoalProgress(tx, goal.id);

    await notify(tx, {
      to: [profile.userId],
      type: NOTIFICATION_TYPES.SESSION_LOGGED,
      actorId: mentor.id,
      href: notificationHref.studentHome(),
      message: rescheduled
        ? `${mentorLabel} recorded that your ${formatHours(hoursParsed.value)}-hour meeting on ${formatDate(dateParsed.value)} for "${goal.purpose}" was rescheduled. No hours were charged.`
        : state === ATTENDANCE.ABSENT
          ? `${mentorLabel} recorded a ${formatHours(hoursParsed.value)}-hour no-show on ${formatDate(dateParsed.value)} for "${goal.purpose}". Those hours were still deducted.`
          : `${mentorLabel} logged a ${formatHours(hoursParsed.value)}-hour session on ${formatDate(dateParsed.value)} toward "${goal.purpose}"${state === ATTENDANCE.LATE ? ", which you came late to" : ""}.`,
    });

    // Staff watch delivery across every program, so a logged session is news
    // to them as much as to the student.
    await notify(tx, {
      to: staff,
      type: NOTIFICATION_TYPES.SESSION_LOGGED,
      actorId: mentor.id,
      href: notificationHref.adminStudent(profile.id),
      message: rescheduled
        ? `${mentorLabel} rescheduled a ${formatHours(hoursParsed.value)}h meeting with ${studentName} on ${formatDate(dateParsed.value)} ("${goal.purpose}") — no hours charged.`
        : state === ATTENDANCE.ABSENT
          ? `${mentorLabel} recorded a ${formatHours(hoursParsed.value)}h no-show for ${studentName} on ${formatDate(dateParsed.value)} ("${goal.purpose}").`
          : `${mentorLabel} logged ${formatHours(hoursParsed.value)}h with ${studentName} on ${formatDate(dateParsed.value)} toward "${goal.purpose}"${state === ATTENDANCE.LATE ? " (came late)" : ""}.`,
    });

    if (synced?.becameDone) {
      await notify(tx, {
        to: staff,
        type: NOTIFICATION_TYPES.GOAL_DONE,
        actorId: mentor.id,
        href: notificationHref.adminStudent(profile.id),
        message: `"${goal.purpose}" for ${studentName} is complete: ${formatHours(synced.loggedHours)} of ${formatHours(synced.hourLimit ?? 0)} planned hours logged.`,
      });
    }
    return synced;
  });

  revalidatePath("/", "layout");

  const remaining = await remainingWith(profile.id, mentor.id, allocation.hours);
  const stateNote =
    state === ATTENDANCE.ATTENDED ? "" : ` Recorded as ${ATTENDANCE_META[state].label.toLowerCase()}.`;
  // Tell the mentor what their own log just did to the task, so an automatic
  // status change is never a surprise they discover later.
  const goalNote = sync?.becameDone
    ? ` "${goal.purpose}" hit its ${formatHours(sync.hourLimit ?? 0)}-hour limit and is now marked done.`
    : sync?.changed
      ? ` "${goal.purpose}" is now in progress.`
      : "";
  if (rescheduled) {
    return {
      ok: true,
      message: `Rescheduled meeting recorded — no hours charged. ${studentName} still has ${formatHours(remaining)} hours left with you.`,
    };
  }
  return {
    ok: true,
    message:
      remaining < 0
        ? `Session logged.${stateNote}${goalNote} Heads up: ${studentName} is now overdrawn by ${formatHours(-remaining)} hours with you.`
        : `Session logged.${stateNote}${goalNote} ${studentName} has ${formatHours(remaining)} hours left with you.`,
  };
}

/**
 * Load a session and verify the acting mentor logged it and it can still be
 * corrected. Anything but a voided session can: a rescheduled one is a live
 * record, and correcting it back to attended is exactly how a mis-tick is fixed.
 */
async function findOwnEditableSession(mentorId: string, sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { student: { include: { user: true } } },
  });
  if (!session || session.mentorId !== mentorId) return null;
  if (session.status === SESSION_STATUS.VOIDED) return null;
  return session;
}

/**
 * Edit a session the mentor logged in error (task/hours/date/notes). The hour
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
  const session = await findOwnEditableSession(mentor.id, sessionId);
  if (!session) {
    return {
      ok: false,
      error: "You can only edit sessions you logged yourself, and not voided ones.",
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
  const state = readAttendance(formData.get("attendance"));
  const fields = attendanceFields(state);

  // The task can be corrected here, but is not forced: sessions logged before
  // tasks existed have none, and re-picking one to fix a typo in the hours
  // would be a strange thing to demand.
  const rawGoal = String(formData.get("assignmentId") ?? "").trim();
  let assignmentId = session.assignmentId;
  if (rawGoal && rawGoal !== session.assignmentId) {
    const goal = await resolveGoal(rawGoal, session.studentId, mentor.id);
    if ("error" in goal) return { ok: false, error: goal.error };
    assignmentId = goal.id;
  }

  const wasState = attendanceOf(session);
  const attendanceNote =
    state === wasState ? "" : ` Now marked as ${ATTENDANCE_META[state].label.toLowerCase()}.`;
  const staff = await adminIds();
  const mentorLabel = mentor.name ?? mentor.email;
  const studentName = session.student.user.name ?? session.student.user.email;
  const change = `now ${formatHours(hoursParsed.value)} hours on ${formatDate(dateParsed.value)} (was ${formatHours(session.hours)} on ${formatDate(session.date)})`;

  await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: session.id },
      data: {
        assignmentId,
        hours: hoursParsed.value,
        date: dateParsed.value,
        note,
        ...fields,
      },
    });

    // Both tasks: the hours left the old one and arrived at the new one, so each
    // has to be re-derived. A task that was auto-completed by these hours drops
    // back to In progress on its own when they move away.
    for (const id of new Set(
      [session.assignmentId, assignmentId].filter((v): v is string => !!v)
    )) {
      await syncGoalProgress(tx, id);
    }

    await notify(tx, {
      to: [session.student.userId],
      type: NOTIFICATION_TYPES.SESSION_EDITED,
      actorId: mentor.id,
      href: notificationHref.studentHome(),
      message: `${mentorLabel} corrected a session: ${change}.${attendanceNote}`,
    });
    await notify(tx, {
      to: staff,
      type: NOTIFICATION_TYPES.SESSION_EDITED,
      actorId: mentor.id,
      href: notificationHref.adminStudent(session.studentId),
      message: `${mentorLabel} corrected a session with ${studentName}: ${change}.${attendanceNote}`,
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
  const session = await findOwnEditableSession(mentor.id, sessionId);
  if (!session) {
    return {
      ok: false,
      error: "You can only void sessions you logged yourself, and not twice.",
    };
  }

  const staff = await adminIds();
  const mentorLabel = mentor.name ?? mentor.email;
  const studentName = session.student.user.name ?? session.student.user.email;

  await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: session.id },
      data: { status: SESSION_STATUS.VOIDED },
    });

    // Voiding returns the hours, so a task these hours had completed reopens.
    if (session.assignmentId) {
      await syncGoalProgress(tx, session.assignmentId);
    }

    await notify(tx, {
      to: [session.student.userId],
      type: NOTIFICATION_TYPES.SESSION_VOIDED,
      actorId: mentor.id,
      href: notificationHref.studentHome(),
      message: `${mentorLabel} voided the ${formatHours(session.hours)}-hour session from ${formatDate(session.date)}. Those hours are back in your balance.`,
    });
    await notify(tx, {
      to: staff,
      type: NOTIFICATION_TYPES.SESSION_VOIDED,
      actorId: mentor.id,
      href: notificationHref.adminStudent(session.studentId),
      message: `${mentorLabel} voided a ${formatHours(session.hours)}-hour session with ${studentName} from ${formatDate(session.date)}; the hours went back.`,
    });
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Session voided; hours returned." };
}
