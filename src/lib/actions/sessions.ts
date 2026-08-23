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
  ROLES,
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
 * Resolve the task a session is being logged against. OPTIONAL: naming one is
 * what lets planned hours be read against delivered ones, but a meeting that
 * fits none of them still happened and still has to be loggable — a mentor
 * shouldn't have to wait on an admin to record work they've already done.
 *
 * When one IS named it must be a task an admin gave THIS mentor for THIS
 * student — nobody logs time against a colleague's task, or another student's —
 * or one with no mentor yet, which logging against claims.
 */
async function resolveGoal(
  raw: FormDataEntryValue | null,
  studentProfileId: string,
  mentorId: string
): Promise<
  | { value: { id: string; purpose: string; unassigned: boolean } | null }
  | { error: string }
> {
  const id = String(raw ?? "").trim();
  if (!id) return { value: null };

  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (
    !assignment ||
    assignment.studentId !== studentProfileId ||
    (assignment.mentorId !== null && assignment.mentorId !== mentorId)
  ) {
    return { error: "That task isn't one of yours for this student." };
  }
  return {
    value: {
      id: assignment.id,
      purpose: assignment.purpose,
      unassigned: assignment.mentorId === null,
    },
  };
}

/**
 * Log a completed session against one of the mentor's open tasks for the
 * student. Draws down the hours the student holds with THIS mentor (derived) —
 * or, when the mentor holds none, carves what the session charges out of the
 * student's unassigned pool into a new allocation of their own — and notifies
 * them. Overdraw is allowed but flagged back to the mentor.
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

  // Sessions draw down hours an admin allocated to THIS mentor — or, when the
  // mentor holds none, the student's unassigned pool: those hours deliberately
  // named no mentor yet, and logging is the act that decides one. The
  // logged hours are carved out of the pool into this mentor's own allocation
  // inside the transaction below, so every number afterwards reads the same as
  // if an admin had granted them directly.
  const allocation = await prisma.hourAllocation.findUnique({
    where: {
      studentId_mentorId: { studentId: profile.id, mentorId: mentor.id },
    },
  });
  const pool = allocation
    ? null
    : await prisma.hourAllocation.findFirst({
        where: { studentId: profile.id, mentorId: null },
      });
  // An allocation of their own IS authorization — an admin granted it. The
  // pool has no such grant, so claiming from it requires actually working in
  // the student's program (and cohort, where the assignment is cohort-scoped):
  // without this, any mentor anywhere could log against any student's pool and
  // carve its hours to themselves.
  const poolScope = pool
    ? await prisma.mentorAssignment.findFirst({
        where: {
          mentorId: mentor.id,
          programId: profile.programId,
          OR: [
            { cohortId: null },
            ...(profile.cohortId ? [{ cohortId: profile.cohortId }] : []),
          ],
        },
      })
    : null;
  if (!allocation && !(pool && poolScope)) {
    return {
      ok: false,
      error:
        "No hours were allocated to you for that student, and they hold no unassigned hours you can log against. Ask an admin to allocate hours first.",
    };
  }

  // Deadlines are hard: once passed, the unused hours are forfeited and no
  // further sessions can be logged against this allocation. A rescheduled
  // meeting charges nothing, but recording one against expired hours would still
  // be recording work on a pool that is closed.
  const source = allocation ?? pool!;
  if (source.deadline.getTime() < Date.now()) {
    return {
      ok: false,
      error: `These hours expired on ${formatDate(source.deadline)} and can no longer be logged against. Ask an admin to extend the deadline or allocate new hours.`,
    };
  }

  // Checked after the allocation, so a mentor with no hours for this student
  // hears about that first rather than being told about a task they can't use.
  const resolved = await resolveGoal(
    formData.get("assignmentId"),
    profile.id,
    mentor.id
  );
  if ("error" in resolved) return { ok: false, error: resolved.error };
  const goal = resolved.value;
  // Reads "toward "Main essay"" when there is one, and nothing at all when there
  // isn't, rather than an empty pair of quotes.
  const toward = goal ? ` toward "${goal.purpose}"` : "";
  const forTask = goal ? ` for "${goal.purpose}"` : "";

  const staff = await adminIds();
  const mentorLabel = mentor.name ?? mentor.email;
  const studentName = profile.user.name ?? profile.user.email;

  const { sync, carved, poolAfter } = await prisma.$transaction(async (tx) => {
    await tx.session.create({
      data: {
        studentId: profile.id,
        mentorId: mentor.id,
        assignmentId: goal?.id ?? null,
        hours: hoursParsed.value,
        date: dateParsed.value,
        note,
        ...fields,
      },
    });

    // The carve, when logging from the pool: what the session charges becomes
    // this mentor's own allocation, and the pool shrinks by the same amount. A
    // rescheduled meeting charges nothing, so it moves nothing. min() because
    // overdraw is warned, never blocked — logging past what the pool holds is
    // allowed, and the shortfall shows as overdraw on the mentor's new row.
    //
    // The amounts come from a re-read INSIDE the transaction: the gate's pool
    // read is stale by now if two mentors log at once, and computing from it
    // would let both carve the same hours. A pool an admin removed mid-flight
    // reads as empty — the session still logs, nothing moves.
    let carved = 0;
    let poolAfter = 0;
    if (pool && !rescheduled) {
      const freshPool = await tx.hourAllocation.findUnique({
        where: { id: pool.id },
      });
      const available = freshPool?.hours ?? 0;
      carved = Math.max(0, Math.min(available, hoursParsed.value));
      poolAfter = Number((available - carved).toFixed(2));
      if (freshPool && carved > 0) {
        // Money stays banked on the pool row: amountPaid records what was paid
        // for the original grant, not who ended up delivering it.
        await tx.hourAllocation.update({
          where: { id: freshPool.id },
          data: { hours: poolAfter },
        });
        // A double-submit can land here with the first carve's allocation
        // already created; the second tops it up instead of violating the
        // (student, mentor) unique index.
        const mine = await tx.hourAllocation.findUnique({
          where: {
            studentId_mentorId: { studentId: profile.id, mentorId: mentor.id },
          },
        });
        const mineBefore = mine?.hours ?? 0;
        const mineAfter = Number((mineBefore + carved).toFixed(2));
        if (mine) {
          await tx.hourAllocation.update({
            where: { id: mine.id },
            data: { hours: mineAfter },
          });
        } else {
          await tx.hourAllocation.create({
            data: {
              studentId: profile.id,
              mentorId: mentor.id,
              hours: carved,
              deadline: freshPool.deadline,
            },
          });
        }
        // Both sides of the hand-off audited, so the allocation history reads
        // where the pool's hours went.
        await tx.hourAllotmentChange.createMany({
          data: [
            {
              studentId: profile.id,
              mentorId: null,
              changedById: mentor.id,
              oldHours: available,
              newHours: poolAfter,
            },
            {
              studentId: profile.id,
              mentorId: mentor.id,
              changedById: mentor.id,
              oldHours: mineBefore,
              newHours: mineAfter,
            },
          ],
        });
      }
    }

    // A named task that had no mentor yet: logging against it claims it.
    if (goal?.unassigned) {
      await tx.assignment.update({
        where: { id: goal.id },
        data: { mentorId: mentor.id },
      });
    }

    // Progress follows the hours: this may move the task to In progress, or
    // finish it outright if the logged total reached its limit. A session that
    // names no task moves nothing.
    const synced = goal ? await syncGoalProgress(tx, goal.id) : null;

    await notify(tx, {
      to: [profile.userId],
      type: NOTIFICATION_TYPES.SESSION_LOGGED,
      actorId: mentor.id,
      href: notificationHref.studentHome(),
      message: rescheduled
        ? `${mentorLabel} recorded that your ${formatHours(hoursParsed.value)}-hour meeting on ${formatDate(dateParsed.value)}${forTask} was rescheduled. No hours were charged.`
        : state === ATTENDANCE.ABSENT
          ? `${mentorLabel} recorded a ${formatHours(hoursParsed.value)}-hour no-show on ${formatDate(dateParsed.value)}${forTask}. Those hours were still deducted.`
          : `${mentorLabel} logged a ${formatHours(hoursParsed.value)}-hour session on ${formatDate(dateParsed.value)}${toward}${state === ATTENDANCE.LATE ? ", which you came late to" : ""}.`,
    });

    // Staff watch delivery across every program, so a logged session is news
    // to them as much as to the student.
    await notify(tx, {
      to: staff,
      type: NOTIFICATION_TYPES.SESSION_LOGGED,
      actorId: mentor.id,
      href: notificationHref.adminStudent(profile.id),
      message:
        (rescheduled
          ? `${mentorLabel} rescheduled a ${formatHours(hoursParsed.value)}h meeting with ${studentName} on ${formatDate(dateParsed.value)}${forTask} — no hours charged.`
          : state === ATTENDANCE.ABSENT
            ? `${mentorLabel} recorded a ${formatHours(hoursParsed.value)}h no-show for ${studentName} on ${formatDate(dateParsed.value)}${forTask}.`
            : `${mentorLabel} logged ${formatHours(hoursParsed.value)}h with ${studentName} on ${formatDate(dateParsed.value)}${toward}${state === ATTENDANCE.LATE ? " (came late)" : ""}.`) +
        // The hand-off is news an admin would otherwise reconstruct from the
        // allocation history: the pool chose its mentor.
        (carved > 0
          ? ` The hours came out of the unassigned pool (${formatHours(poolAfter)} left in it).`
          : ""),
    });

    if (synced?.becameDone) {
      await notify(tx, {
        to: staff,
        type: NOTIFICATION_TYPES.GOAL_DONE,
        actorId: mentor.id,
        href: notificationHref.adminStudent(profile.id),
        message: `"${synced.purpose}" for ${studentName} is complete: ${formatHours(synced.loggedHours)} of ${formatHours(synced.hourLimit ?? 0)} planned hours logged.`,
      });
    }
    return { sync: synced, carved, poolAfter };
  });

  revalidatePath("/", "layout");

  const stateNote =
    state === ATTENDANCE.ATTENDED ? "" : ` Recorded as ${ATTENDANCE_META[state].label.toLowerCase()}.`;
  // Tell the mentor what their own log just did to the task, so an automatic
  // status change is never a surprise they discover later.
  const goalNote = sync?.becameDone
    ? ` "${sync.purpose}" hit its ${formatHours(sync.hourLimit ?? 0)}-hour limit and is now marked done.`
    : sync?.changed
      ? ` "${sync.purpose}" is now in progress.`
      : "";
  if (rescheduled) {
    return {
      ok: true,
      message: pool
        ? `Rescheduled meeting recorded — no hours charged, and ${studentName}'s unassigned pool is untouched.`
        : `Rescheduled meeting recorded — no hours charged. ${studentName} still has ${formatHours(await remainingWith(profile.id, mentor.id, allocation!.hours))} hours left with you.`,
    };
  }
  if (pool) {
    // What the carve just did, in the mentor's terms: these hours are theirs
    // now, and here is what the pool still holds for whoever meets them next.
    const short = Number((hoursParsed.value - carved).toFixed(2));
    return {
      ok: true,
      message:
        short > 0
          ? `Session logged.${stateNote}${goalNote} ${formatHours(carved)} unassigned hours moved to you — the pool came up ${formatHours(short)} short, so ${studentName} is overdrawn with you.`
          : `Session logged.${stateNote}${goalNote} ${formatHours(carved)} of ${studentName}'s unassigned hours moved to you; ${formatHours(poolAfter)} remain in the pool.`,
    };
  }
  const remaining = await remainingWith(profile.id, mentor.id, allocation!.hours);
  return {
    ok: true,
    message:
      remaining < 0
        ? `Session logged.${stateNote}${goalNote} Heads up: ${studentName} is now overdrawn by ${formatHours(-remaining)} hours with you.`
        : `Session logged.${stateNote}${goalNote} ${studentName} has ${formatHours(remaining)} hours left with you.`,
  };
}

/**
 * Who may change a logged session: the mentor who logged it, and any admin.
 *
 * A mentor owns their own log — correcting yesterday's hours shouldn't need
 * anyone's permission. An admin owns the ledger, and rows arrive in it that no
 * mentor will ever fix: a duplicate from the spreadsheet import, a session
 * logged against the wrong student, a test row. Without this, the only way to
 * remove one was the database.
 */
async function requireSessionAuthority() {
  const actor = await getCurrentUser();
  if (!actor) return null;
  if (actor.role === ROLES.ADMIN) return { actor, isAdmin: true };
  if (!canActAsMentor(actor) || actor.status !== USER_STATUS.ACTIVE) return null;
  return { actor, isAdmin: false };
}

/**
 * Load a session the actor is allowed to change. Anything but a voided session
 * can be corrected: a rescheduled one is a live record, and correcting it back
 * to attended is exactly how a mis-tick is fixed.
 */
async function findEditableSession(
  actorId: string,
  isAdmin: boolean,
  sessionId: string
) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { student: { include: { user: true } }, mentor: true },
  });
  if (!session) return null;
  if (!isAdmin && session.mentorId !== actorId) return null;
  if (session.status === SESSION_STATUS.VOIDED) return null;
  return session;
}

/**
 * Correct a logged session — its task, hours, date, notes, or how the meeting
 * went. The hour delta flows through derived totals; the student is told, and so
 * is the mentor when it wasn't them who made the change.
 */
export async function editSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await requireSessionAuthority();
  if (!auth) {
    return { ok: false, error: "Only the mentor who logged a session, or an admin, can edit it." };
  }
  const { actor, isAdmin } = auth;

  const sessionId = String(formData.get("sessionId") ?? "");
  const session = await findEditableSession(actor.id, isAdmin, sessionId);
  if (!session) {
    return {
      ok: false,
      error: isAdmin
        ? "That session is gone, or already voided."
        : "You can only edit sessions you logged yourself, and not voided ones.",
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
  // would be a strange thing to demand. It stays scoped to the mentor who ran
  // the meeting, even when an admin is the one correcting it.
  const rawGoal = String(formData.get("assignmentId") ?? "").trim();
  let assignmentId = session.assignmentId;
  if (rawGoal && rawGoal !== session.assignmentId) {
    const resolved = await resolveGoal(rawGoal, session.studentId, session.mentorId);
    if ("error" in resolved) return { ok: false, error: resolved.error };
    assignmentId = resolved.value?.id ?? null;
  }

  const wasState = attendanceOf(session);
  const attendanceNote =
    state === wasState ? "" : ` Now marked as ${ATTENDANCE_META[state].label.toLowerCase()}.`;
  const staff = await adminIds();
  const actorLabel = actor.name ?? actor.email;
  const mentorLabel = session.mentor.name ?? session.mentor.email;
  const studentName = session.student.user.name ?? session.student.user.email;
  const whose = session.mentorId === actor.id ? "a session" : `${mentorLabel}'s session`;
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
      // notify() drops the actor, so the mentor only hears about it when someone
      // else changed their log.
      to: [session.student.userId, session.mentorId],
      type: NOTIFICATION_TYPES.SESSION_EDITED,
      actorId: actor.id,
      href: notificationHref.studentHome(),
      message: `${actorLabel} corrected ${whose}: ${change}.${attendanceNote}`,
    });
    await notify(tx, {
      to: staff,
      type: NOTIFICATION_TYPES.SESSION_EDITED,
      actorId: actor.id,
      href: notificationHref.adminStudent(session.studentId),
      message: `${actorLabel} corrected ${whose} with ${studentName}: ${change}.${attendanceNote}`,
    });
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Session updated." };
}

/** Void a session logged in error — the row stays, the hours go back. */
export async function voidSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await requireSessionAuthority();
  if (!auth) {
    return { ok: false, error: "Only the mentor who logged a session, or an admin, can void it." };
  }
  const { actor, isAdmin } = auth;

  const sessionId = String(formData.get("sessionId") ?? "");
  const session = await findEditableSession(actor.id, isAdmin, sessionId);
  if (!session) {
    return {
      ok: false,
      error: isAdmin
        ? "That session is gone, or already voided."
        : "You can only void sessions you logged yourself, and not twice.",
    };
  }

  const staff = await adminIds();
  const actorLabel = actor.name ?? actor.email;
  const mentorLabel = session.mentor.name ?? session.mentor.email;
  const studentName = session.student.user.name ?? session.student.user.email;
  const whose = session.mentorId === actor.id ? "the" : `${mentorLabel}'s`;

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
      to: [session.student.userId, session.mentorId],
      type: NOTIFICATION_TYPES.SESSION_VOIDED,
      actorId: actor.id,
      href: notificationHref.studentHome(),
      message: `${actorLabel} voided ${whose} ${formatHours(session.hours)}-hour session from ${formatDate(session.date)}. Those hours are back in the balance.`,
    });
    await notify(tx, {
      to: staff,
      type: NOTIFICATION_TYPES.SESSION_VOIDED,
      actorId: actor.id,
      href: notificationHref.adminStudent(session.studentId),
      message: `${actorLabel} voided ${whose} ${formatHours(session.hours)}-hour session with ${studentName} from ${formatDate(session.date)}; the hours went back.`,
    });
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Session voided; hours returned." };
}

/**
 * Remove a logged session outright (admin only). Voiding is the mentor's tool —
 * it keeps the row as history and hands the hours back. Deleting is for rows
 * that should never have been history at all: a duplicate the spreadsheet import
 * brought in twice, a meeting logged against the wrong student, a test entry.
 * The hours return the same way, and everyone who could see the row is told.
 */
export async function deleteSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return {
      ok: false,
      error: "Only admins can delete a session. Mentors can void their own instead, which keeps the record.",
    };
  }

  const sessionId = String(formData.get("sessionId") ?? "");
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { student: { include: { user: true } }, mentor: true },
  });
  if (!session) return { ok: false, error: "That session is already gone." };

  const staff = await adminIds();
  const actorLabel = actor.name ?? actor.email;
  const mentorLabel = session.mentor.name ?? session.mentor.email;
  const studentName = session.student.user.name ?? session.student.user.email;
  const wasCharging = session.status === SESSION_STATUS.ACTIVE;
  const what = `${formatHours(session.hours)}-hour session with ${mentorLabel} from ${formatDate(session.date)}`;
  const hoursNote = wasCharging ? " Those hours are back in the balance." : "";

  await prisma.$transaction(async (tx) => {
    await tx.session.delete({ where: { id: session.id } });

    // The hours left with the row, so anything they had finished reopens.
    if (session.assignmentId) {
      await syncGoalProgress(tx, session.assignmentId);
    }

    await notify(tx, {
      to: [session.student.userId, session.mentorId],
      type: NOTIFICATION_TYPES.SESSION_DELETED,
      actorId: actor.id,
      href: notificationHref.studentHome(),
      message: `${actorLabel} removed the ${what} from the log.${hoursNote}`,
    });
    await notify(tx, {
      to: staff,
      type: NOTIFICATION_TYPES.SESSION_DELETED,
      actorId: actor.id,
      href: notificationHref.adminStudent(session.studentId),
      message: `${actorLabel} removed a ${what} for ${studentName}.${hoursNote}`,
    });
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Session removed.${hoursNote}`,
  };
}
