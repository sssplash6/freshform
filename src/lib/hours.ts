import { prisma } from "@/lib/prisma";
import { SESSION_STATUS } from "@/lib/constants";

/**
 * Derived hour values (spec §5): never stored as mutable counters.
 *  - allottedHours  = sum of the student's per-mentor HourAllocation rows
 *  - usedHours      = sum of hours over the student's ACTIVE sessions
 *                     (present AND no-show — a no-show still draws the hours down)
 *  - missedHours    = subset of used hours logged as a no-show (attended = false)
 *  - completedHours = usedHours − missedHours (hours actually delivered)
 *  - remainingHours = allottedHours − usedHours
 * The same values also exist per mentor: an allocation is drawn down only by
 * ACTIVE sessions logged by that mentor.
 */

export async function completedHours(studentProfileId: string): Promise<number> {
  const result = await prisma.session.aggregate({
    where: { studentId: studentProfileId, status: SESSION_STATUS.ACTIVE },
    _sum: { hours: true },
  });
  return result._sum.hours ?? 0;
}

/** Per-mentor balances for one student, plus overall totals. */
export async function allocationSummary(studentProfileId: string) {
  const [allocations, sessionSums] = await Promise.all([
    prisma.hourAllocation.findMany({
      where: { studentId: studentProfileId },
      include: { mentor: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.session.groupBy({
      by: ["mentorId", "attended"],
      where: { studentId: studentProfileId, status: SESSION_STATUS.ACTIVE },
      _sum: { hours: true },
    }),
  ]);

  // Hours drawn down per mentor (present + no-show), and the no-show subset.
  const usedByMentor = new Map<string, number>();
  const missedByMentor = new Map<string, number>();
  for (const s of sessionSums) {
    const hrs = s._sum.hours ?? 0;
    usedByMentor.set(s.mentorId, (usedByMentor.get(s.mentorId) ?? 0) + hrs);
    if (!s.attended) {
      missedByMentor.set(s.mentorId, (missedByMentor.get(s.mentorId) ?? 0) + hrs);
    }
  }

  // Once a deadline passes, the allocation's unused hours are forfeited: they
  // stop counting toward "remaining" and surface as "expired".
  const now = Date.now();
  const perMentor = allocations.map((a) => {
    const used = usedByMentor.get(a.mentorId) ?? 0;
    const missed = missedByMentor.get(a.mentorId) ?? 0;
    const expired = a.deadline.getTime() < now;
    const forfeited = expired ? Math.max(0, a.hours - used) : 0;
    return {
      mentor: a.mentor,
      allocated: a.hours,
      completed: used - missed,
      missed,
      // Unused hours on an expired allocation are gone; only overdraw remains.
      remaining: expired ? Math.min(0, a.hours - used) : a.hours - used,
      forfeited,
      expired,
      deadline: a.deadline,
      amountPaid: a.amountPaid,
    };
  });

  const allotted = allocations.reduce((sum, a) => sum + a.hours, 0);
  // Count every active session, including any logged by a mentor whose
  // allocation was later removed — the student still used those hours.
  const used = sessionSums.reduce((sum, s) => sum + (s._sum.hours ?? 0), 0);
  const missed = sessionSums
    .filter((s) => !s.attended)
    .reduce((sum, s) => sum + (s._sum.hours ?? 0), 0);
  const forfeited = perMentor.reduce((sum, m) => sum + m.forfeited, 0);
  const paid = allocations.reduce((sum, a) => sum + (a.amountPaid ?? 0), 0);

  return {
    perMentor,
    allotted,
    completed: used - missed,
    missed,
    used,
    forfeited,
    paid,
    remaining: allotted - used - forfeited,
  };
}

/** Remaining hours a student has with one specific mentor. */
export async function remainingWithMentor(
  studentProfileId: string,
  mentorId: string
): Promise<number | null> {
  const allocation = await prisma.hourAllocation.findUnique({
    where: {
      studentId_mentorId: { studentId: studentProfileId, mentorId },
    },
  });
  if (!allocation) return null;
  const used = await prisma.session.aggregate({
    where: {
      studentId: studentProfileId,
      mentorId,
      status: SESSION_STATUS.ACTIVE,
    },
    _sum: { hours: true },
  });
  return allocation.hours - (used._sum.hours ?? 0);
}
