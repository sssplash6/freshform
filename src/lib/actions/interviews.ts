"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/dal";
import { mentorReaches } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import type { User } from "@/generated/prisma/client";
import {
  canActAsMentor,
  INTERVIEW_STATUS,
  interviewIsOpen,
  NOTIFICATION_TYPES,
  ROLES,
  USER_STATUS,
} from "@/lib/constants";
import { formatMeetingWhen } from "@/lib/format";
import { notify, notificationHref } from "@/lib/notify";
import {
  parseDateField,
  parseLinkField,
  parseTimeOnto,
  type ActionState,
} from "@/lib/actions/shared";

/**
 * Scheduling a meeting — the mentor puts it in the diary, the student says
 * whether they'll be there. Deliberately separate from logging a session: this
 * charges nothing and may never happen. It becomes hours only when the mentor
 * logs it afterwards (see logSession, which retires the meeting it delivered).
 */

/** A mentor in good standing. Unassigned mentors have no students yet. */
async function requireActiveMentor() {
  const actor = await getCurrentUser();
  if (!actor || !canActAsMentor(actor)) return null;
  if (actor.status !== USER_STATUS.ACTIVE) return null;
  return actor;
}

/**
 * The student to book with, when this mentor may book with them at all.
 *
 * Reach IS the permission here: without it any mentor could put a meeting in
 * any student's diary and notify them about it. It is asked with `mentorReaches`
 * rather than rebuilt, so the students the mentor's own pages offer and the
 * students the booking form accepts cannot drift apart — a picker that lists
 * somebody the form then refuses is the same bug in two places.
 */
async function reachableStudent(mentor: User, studentProfileId: string) {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    include: { user: true },
  });
  if (!profile) return null;
  return (await mentorReaches(mentor, profile)) ? profile : null;
}

/** Date + optional time + optional link/note, as the two forms both send them. */
function readMeetingFields(formData: FormData):
  | { error: string }
  | {
      value: {
        scheduledAt: Date;
        hasTime: boolean;
        link: string | null;
        note: string | null;
      };
    } {
  const date = parseDateField(formData.get("date"));
  if ("error" in date) return { error: date.error };
  const when = parseTimeOnto(date.value, formData.get("time"));
  if ("error" in when) return { error: when.error };
  const link = parseLinkField(formData.get("link"), "The meeting link");
  if ("error" in link) return { error: link.error };

  // A meeting in the past can't be attended, and the student is being asked to
  // confirm they'll be there. Whole days, so "today" always works.
  const today = new Date();
  const todayStart = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  if (date.value.getTime() < todayStart) {
    return { error: "Pick today or a later date — this meeting hasn't happened yet." };
  }

  return {
    value: {
      scheduledAt: when.value,
      hasTime: when.hasTime,
      link: link.value,
      note: String(formData.get("note") ?? "").trim() || null,
    },
  };
}

/**
 * Put a meeting in the diary and ask the student to confirm. The student is
 * notified with everything they need to turn up — when, with whom, where, and
 * what it's about — and their answer comes back as a notification to the mentor.
 */
export async function scheduleInterview(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const mentor = await requireActiveMentor();
  if (!mentor) {
    return { ok: false, error: "Only assigned mentors can schedule meetings." };
  }

  const profile = await reachableStudent(
    mentor,
    String(formData.get("studentProfileId") ?? "")
  );
  if (!profile) {
    return { ok: false, error: "That isn't one of your students." };
  }
  if (profile.user.status !== USER_STATUS.ACTIVE) {
    return {
      ok: false,
      error: "That student hasn't been approved by an admin yet.",
    };
  }

  const fields = readMeetingFields(formData);
  if ("error" in fields) return { ok: false, error: fields.error };
  const { scheduledAt, hasTime, link, note } = fields.value;

  const mentorLabel = mentor.name ?? mentor.email;
  const when = formatMeetingWhen(scheduledAt, hasTime);

  await prisma.$transaction(async (tx) => {
    await tx.interview.create({
      data: {
        studentId: profile.id,
        mentorId: mentor.id,
        scheduledAt,
        hasTime,
        link,
        note,
      },
    });
    await notify(tx, {
      to: [profile.userId],
      type: NOTIFICATION_TYPES.INTERVIEW_SCHEDULED,
      actorId: mentor.id,
      href: notificationHref.studentHome(),
      message: `${mentorLabel} scheduled an interview with you on ${when}${
        note ? ` — ${note}` : ""
      }. Confirm on your home page that you'll be there.`,
    });
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Interview scheduled for ${when}. ${
      profile.user.name?.split(" ")[0] ?? "The student"
    } has been asked to confirm.`,
  };
}

/**
 * Load a meeting this mentor may still change. Held and cancelled meetings are
 * closed: the first became hours, the second is off, and editing either would
 * rewrite something people have already been told.
 */
async function findOpenMeeting(mentorId: string, interviewId: string) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: { student: { include: { user: true } } },
  });
  if (!interview || interview.mentorId !== mentorId) return null;
  if (!interviewIsOpen(interview)) return null;
  return interview;
}

/**
 * Move a meeting, or correct its link or note. A NEW TIME reopens the question:
 * the status returns to PROPOSED and the student is asked again, because "I'll
 * be there" was an answer about Thursday, not about whenever it moved to. A
 * changed link or note leaves an existing confirmation standing.
 */
export async function rescheduleInterview(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const mentor = await requireActiveMentor();
  if (!mentor) {
    return { ok: false, error: "Only assigned mentors can change a meeting." };
  }

  const interview = await findOpenMeeting(
    mentor.id,
    String(formData.get("interviewId") ?? "")
  );
  if (!interview) {
    return {
      ok: false,
      error: "That meeting is gone, already logged, or already cancelled.",
    };
  }

  const fields = readMeetingFields(formData);
  if ("error" in fields) return { ok: false, error: fields.error };
  const { scheduledAt, hasTime, link, note } = fields.value;

  const moved =
    scheduledAt.getTime() !== interview.scheduledAt.getTime() ||
    hasTime !== interview.hasTime;
  const mentorLabel = mentor.name ?? mentor.email;
  const was = formatMeetingWhen(interview.scheduledAt, interview.hasTime);
  const when = formatMeetingWhen(scheduledAt, hasTime);

  await prisma.$transaction(async (tx) => {
    await tx.interview.update({
      where: { id: interview.id },
      data: {
        scheduledAt,
        hasTime,
        link,
        note,
        ...(moved
          ? { status: INTERVIEW_STATUS.PROPOSED, respondedAt: null }
          : {}),
      },
    });
    await notify(tx, {
      to: [interview.student.userId],
      type: moved
        ? NOTIFICATION_TYPES.INTERVIEW_MOVED
        : NOTIFICATION_TYPES.INTERVIEW_SCHEDULED,
      actorId: mentor.id,
      href: notificationHref.studentHome(),
      message: moved
        ? `${mentorLabel} moved your interview from ${was} to ${when}. Confirm on your home page that the new time works.`
        : `${mentorLabel} updated the details of your interview on ${when}${
            note ? ` — ${note}` : ""
          }.`,
    });
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: moved
      ? `Moved to ${when}. ${interview.student.user.name?.split(" ")[0] ?? "The student"} has been asked to confirm the new time.`
      : "Meeting details updated.",
  };
}

/** Call a meeting off. The student is told; the row stays as history. */
export async function cancelInterview(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const mentor = await requireActiveMentor();
  if (!mentor) {
    return { ok: false, error: "Only assigned mentors can cancel a meeting." };
  }

  const interview = await findOpenMeeting(
    mentor.id,
    String(formData.get("interviewId") ?? "")
  );
  if (!interview) {
    return {
      ok: false,
      error: "That meeting is gone, already logged, or already cancelled.",
    };
  }

  const mentorLabel = mentor.name ?? mentor.email;
  const when = formatMeetingWhen(interview.scheduledAt, interview.hasTime);

  await prisma.$transaction(async (tx) => {
    await tx.interview.update({
      where: { id: interview.id },
      data: { status: INTERVIEW_STATUS.CANCELLED },
    });
    await notify(tx, {
      to: [interview.student.userId],
      type: NOTIFICATION_TYPES.INTERVIEW_CANCELLED,
      actorId: mentor.id,
      href: notificationHref.studentHome(),
      message: `${mentorLabel} cancelled the interview that was set for ${when}.`,
    });
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Meeting cancelled; the student has been told." };
}

/**
 * The student's answer: they'll be there, or they can't make it. Either way the
 * mentor hears about it — a declined meeting is the one they most need to know
 * about, and silence is what scheduling over Telegram already gave them.
 *
 * Answering again is allowed: plans change, and a student who confirmed on
 * Monday and can't make it by Wednesday should be able to say so here.
 */
export async function respondToInterview(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.STUDENT) {
    return { ok: false, error: "Only the student can answer their own meeting." };
  }

  const going = String(formData.get("going") ?? "") === "yes";
  const interview = await prisma.interview.findUnique({
    where: { id: String(formData.get("interviewId") ?? "") },
    include: { student: true, mentor: true },
  });
  if (!interview || interview.student.userId !== actor.id) {
    return { ok: false, error: "That meeting isn't one of yours." };
  }
  if (!interviewIsOpen(interview)) {
    return {
      ok: false,
      error:
        interview.status === INTERVIEW_STATUS.CANCELLED
          ? "That meeting was cancelled."
          : "That meeting has already happened.",
    };
  }

  const studentLabel = actor.name ?? actor.email;
  const when = formatMeetingWhen(interview.scheduledAt, interview.hasTime);

  await prisma.$transaction(async (tx) => {
    await tx.interview.update({
      where: { id: interview.id },
      data: {
        status: going ? INTERVIEW_STATUS.CONFIRMED : INTERVIEW_STATUS.DECLINED,
        respondedAt: new Date(),
      },
    });
    await notify(tx, {
      to: [interview.mentorId],
      type: NOTIFICATION_TYPES.INTERVIEW_ANSWERED,
      actorId: actor.id,
      href: notificationHref.mentorStudent(interview.studentId),
      message: going
        ? `${studentLabel} confirmed they'll be at your interview on ${when}.`
        : `${studentLabel} can't make the interview on ${when} — you may want to reschedule it.`,
    });
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: going
      ? `Confirmed — see you on ${when}.`
      : `We've let ${interview.mentor.name?.split(" ")[0] ?? "your mentor"} know you can't make it.`,
  };
}
