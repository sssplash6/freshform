import "server-only";

import {
  ASSIGNMENT_PROGRESS,
  SESSION_STATUS,
  type AssignmentProgress,
} from "@/lib/constants";
import type { Prisma } from "@/generated/prisma/client";

/**
 * A goal's progress follows the hours logged against it, so nobody has to
 * remember to tick anything:
 *
 *   no hours logged                  → Not started
 *   some hours, under the limit      → In progress
 *   hours reach the limit            → Done
 *
 * A goal with no hour limit has no finish line, so it can reach In progress but
 * never Done on its own — that one an admin states by hand.
 *
 * Two rules keep this from fighting people:
 *
 *  - `progressManual` pins a goal. An admin who says "done" has usually
 *    finished the work under budget, and hours arriving later must not silently
 *    reopen it.
 *  - Voided sessions don't count. Voiding returns the hours, so a goal that was
 *    auto-completed by a session later voided drops back on its own.
 */

/** What the hours say this goal's progress is. */
export function deriveProgress(
  loggedMinutes: number,
  minuteLimit: number | null
): AssignmentProgress {
  if (loggedMinutes <= 0) return ASSIGNMENT_PROGRESS.NOT_STARTED;
  if (minuteLimit != null && minuteLimit > 0 && loggedMinutes >= minuteLimit) {
    return ASSIGNMENT_PROGRESS.DONE;
  }
  return ASSIGNMENT_PROGRESS.IN_PROGRESS;
}

export type GoalSyncResult = {
  assignmentId: string;
  purpose: string;
  /** Null when the task has no mentor yet. */
  mentorId: string | null;
  studentId: string;
  loggedMinutes: number;
  minuteLimit: number | null;
  from: string;
  to: AssignmentProgress;
  changed: boolean;
  /** True only on the transition INTO Done, which is what's worth announcing. */
  becameDone: boolean;
};

/**
 * Recompute one goal's progress from its ACTIVE sessions and store it. Call
 * after anything that changes hours against a goal: logging, editing, voiding a
 * session, or an admin moving the hour limit (lowering it can finish a goal).
 *
 * Returns what happened so the caller can announce a completion; null when the
 * goal is gone or pinned by an admin.
 */
export async function syncGoalProgress(
  tx: Prisma.TransactionClient,
  assignmentId: string
): Promise<GoalSyncResult | null> {
  const goal = await tx.assignment.findUnique({ where: { id: assignmentId } });
  if (!goal || goal.progressManual) return null;

  const sum = await tx.session.aggregate({
    where: { assignmentId, status: SESSION_STATUS.ACTIVE },
    _sum: { minutes: true },
  });
  // Float noise: 0.1 + 0.2 must not read as short of a 0.3 limit.
  const loggedMinutes = Number((sum._sum.minutes ?? 0).toFixed(2));
  const next = deriveProgress(loggedMinutes, goal.minuteLimit);

  const changed = next !== goal.progress;
  if (changed) {
    await tx.assignment.update({
      where: { id: assignmentId },
      data: { progress: next },
    });
  }

  return {
    assignmentId,
    purpose: goal.purpose,
    mentorId: goal.mentorId,
    studentId: goal.studentId,
    loggedMinutes,
    minuteLimit: goal.minuteLimit,
    from: goal.progress,
    to: next,
    changed,
    becameDone:
      changed &&
      next === ASSIGNMENT_PROGRESS.DONE &&
      goal.progress !== ASSIGNMENT_PROGRESS.DONE,
  };
}
