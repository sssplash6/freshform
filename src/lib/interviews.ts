import { INTERVIEW_STATUS, interviewIsOpen } from "@/lib/constants";

/**
 * Client-safe helpers for scheduled meetings. The split between "still coming"
 * and "behind us" is a rule, not a query filter: a meeting that was never
 * cancelled and never logged is still open at 6pm on the day it was due, and
 * calling it upcoming would leave it there for good.
 */

/** The structural shape both the student's and the mentor's lists need. */
export type ScheduledMeeting = {
  id: string;
  scheduledAt: Date;
  hasTime: boolean;
  link: string | null;
  note: string | null;
  status: string;
  respondedAt: Date | null;
  sessionId: string | null;
  mentor: { id: string; name: string | null; email: string };
  student?: { id: string; user: { name: string | null; email: string } };
};

/** Midnight UTC on the day of `d` — the boundary a whole-day meeting turns on. */
function dayStart(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Three buckets, because a scheduled meeting has three quite different claims
 * on attention:
 *
 *   upcoming  still to come — the student may still need to answer it
 *   overdue   its time has passed and nobody logged or cancelled it: the
 *             mentor owes it an outcome
 *   closed    held (the hours are logged) or called off — history
 *
 * A meeting on today's date counts as upcoming all day: whole-day meetings
 * carry no time to compare against, and one at 09:00 should not drop into
 * "overdue" over lunch while the mentor is still writing it up.
 */
export function splitMeetings<T extends { scheduledAt: Date; status: string }>(
  meetings: T[],
  now: Date = new Date()
): { upcoming: T[]; overdue: T[]; closed: T[] } {
  const today = dayStart(now);
  const upcoming: T[] = [];
  const overdue: T[] = [];
  const closed: T[] = [];

  for (const m of meetings) {
    if (!interviewIsOpen(m)) closed.push(m);
    else if (dayStart(m.scheduledAt) >= today) upcoming.push(m);
    else overdue.push(m);
  }

  const byDate = (dir: number) => (a: T, b: T) =>
    dir * (a.scheduledAt.getTime() - b.scheduledAt.getTime());
  // Soonest first for what's coming; most recent first for what's behind.
  upcoming.sort(byDate(1));
  overdue.sort(byDate(-1));
  closed.sort(byDate(-1));
  return { upcoming, overdue, closed };
}

/** Whether the student still owes this meeting an answer. */
export function awaitingAnswer(meeting: { status: string }): boolean {
  return meeting.status === INTERVIEW_STATUS.PROPOSED;
}
