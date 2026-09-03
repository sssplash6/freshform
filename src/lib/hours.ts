import { prisma } from "@/lib/prisma";
import { CHARGED_SESSION, SESSION_STATUS } from "@/lib/constants";

/**
 * Derived time values (spec §5): never stored as mutable counters. Every figure
 * below is whole MINUTES.
 *  - allotted  = sum of the student's per-mentor HourAllocation rows
 *  - used      = sum of minutes over the student's CHARGING sessions
 *                (present AND no-show — a no-show still draws the time down)
 *  - missed    = subset of used minutes logged as a no-show (attended = false)
 *  - completed = used − missed (time actually delivered)
 *  - remaining = allotted − used
 *  - extra     = minutes logged OUT of plan: delivered, visible, and charged to
 *                nobody, so they sit outside every total above
 * The same values also exist per mentor: an allocation is drawn down only by
 * that mentor's charging sessions.
 *
 * "Charging" is `chargesAllocation()` in lib/constants.ts — active and in-plan.
 */

export async function completedMinutes(studentProfileId: string): Promise<number> {
  const result = await prisma.session.aggregate({
    where: { studentId: studentProfileId, ...CHARGED_SESSION },
    _sum: { minutes: true },
  });
  return result._sum.minutes ?? 0;
}

/** Per-mentor balances for one student, plus overall totals, in minutes. */
export async function allocationSummary(studentProfileId: string) {
  const [allocations, sessionSums] = await Promise.all([
    prisma.hourAllocation.findMany({
      where: { studentId: studentProfileId },
      include: { mentor: true },
      orderBy: { createdAt: "asc" },
    }),
    // Grouped by withinPlan as well as attendance, so one query answers both
    // "what did this draw down?" and "what was given on top?".
    prisma.session.groupBy({
      by: ["mentorId", "attended", "withinPlan"],
      where: { studentId: studentProfileId, status: SESSION_STATUS.ACTIVE },
      _sum: { minutes: true },
    }),
  ]);

  // Minutes drawn down per mentor (present + no-show), the no-show subset, and —
  // separately, because they move no balance — the out-of-plan minutes.
  const usedByMentor = new Map<string, number>();
  const missedByMentor = new Map<string, number>();
  const extraByMentor = new Map<string, number>();
  for (const s of sessionSums) {
    const mins = s._sum.minutes ?? 0;
    if (!s.withinPlan) {
      extraByMentor.set(s.mentorId, (extraByMentor.get(s.mentorId) ?? 0) + mins);
      continue;
    }
    usedByMentor.set(s.mentorId, (usedByMentor.get(s.mentorId) ?? 0) + mins);
    if (!s.attended) {
      missedByMentor.set(s.mentorId, (missedByMentor.get(s.mentorId) ?? 0) + mins);
    }
  }

  // Once a deadline passes, the allocation's unused minutes are forfeited: they
  // stop counting toward "remaining" and surface as "expired".
  const now = Date.now();
  const perMentor: {
    mentor: (typeof allocations)[number]["mentor"];
    allocated: number;
    completed: number;
    missed: number;
    extra: number;
    remaining: number;
    forfeited: number;
    expired: boolean;
    deadline: Date | null;
    amountPaid: number | null;
  }[] = allocations.map((a) => {
    // The unassigned pool (mentor null) can never have sessions against it —
    // sessions are logged by a mentor — so its used/missed are always 0.
    const used = (a.mentorId && usedByMentor.get(a.mentorId)) || 0;
    const missed = (a.mentorId && missedByMentor.get(a.mentorId)) || 0;
    const extra = (a.mentorId && extraByMentor.get(a.mentorId)) || 0;
    const expired = a.deadline.getTime() < now;
    const forfeited = expired ? Math.max(0, a.minutes - used) : 0;
    return {
      mentor: a.mentor,
      allocated: a.minutes,
      completed: used - missed,
      missed,
      extra,
      // Unused minutes on an expired allocation are gone; only overdraw remains.
      remaining: expired ? Math.min(0, a.minutes - used) : a.minutes - used,
      forfeited,
      expired,
      deadline: a.deadline,
      amountPaid: a.amountPaid,
    };
  });

  // Mentors with sessions but no allocation row of their own. Two ways to get
  // there: a mentor working in the student's program may log without holding a
  // grant (the "Whose hours?" tick decides whether it charges), and an admin may
  // remove an allocation afterwards. Either way those minutes are already
  // counted in the totals below, so the breakdown has to name whose they are —
  // otherwise the student and the admin read an overdraw that no row explains.
  // A derived row, so: nothing allotted, no deadline to be past, and whatever
  // was charged showing as the overdraw it is.
  const granted = new Set(allocations.flatMap((a) => (a.mentorId ? [a.mentorId] : [])));
  const ungranted = [...new Set(sessionSums.map((s) => s.mentorId))].filter(
    (id) => !granted.has(id)
  );
  if (ungranted.length > 0) {
    const mentors = await prisma.user.findMany({ where: { id: { in: ungranted } } });
    for (const mentor of mentors) {
      const used = usedByMentor.get(mentor.id) ?? 0;
      const missed = missedByMentor.get(mentor.id) ?? 0;
      perMentor.push({
        mentor,
        allocated: 0,
        completed: used - missed,
        missed,
        extra: extraByMentor.get(mentor.id) ?? 0,
        remaining: -used,
        forfeited: 0,
        expired: false,
        deadline: null,
        amountPaid: null,
      });
    }
  }

  const allotted = allocations.reduce((sum, a) => sum + a.minutes, 0);
  // Count every charging session, including any logged by a mentor whose
  // allocation was later removed — the student still used that time.
  const inPlan = sessionSums.filter((s) => s.withinPlan);
  const used = inPlan.reduce((sum, s) => sum + (s._sum.minutes ?? 0), 0);
  const missed = inPlan
    .filter((s) => !s.attended)
    .reduce((sum, s) => sum + (s._sum.minutes ?? 0), 0);
  // Out-of-plan minutes, whatever the attendance: they are a record of work
  // given beyond the allocation, and never touch allotted / used / remaining.
  const extra = sessionSums
    .filter((s) => !s.withinPlan)
    .reduce((sum, s) => sum + (s._sum.minutes ?? 0), 0);
  const forfeited = perMentor.reduce((sum, m) => sum + m.forfeited, 0);
  const paid = allocations.reduce((sum, a) => sum + (a.amountPaid ?? 0), 0);

  return {
    perMentor,
    allotted,
    completed: used - missed,
    missed,
    used,
    extra,
    forfeited,
    paid,
    remaining: allotted - used - forfeited,
  };
}

export type AllocationSummary = Awaited<ReturnType<typeof allocationSummary>>;

/** Minutes a student has left with one specific mentor. */
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
      ...CHARGED_SESSION,
    },
    _sum: { minutes: true },
  });
  return allocation.minutes - (used._sum.minutes ?? 0);
}

/**
 * One program's — or one cohort's, or the whole platform's — hours, summed
 * across students.
 *
 * There were four copies of this reduce (`admin/page.tsx`, `program-dashboard`,
 * `admin/programs/[id]`, `program-students-island`) plus a separate one for
 * money, and they did not agree on what a total IS: two summed four fields, one
 * summed two, and none carried `extra`, `forfeited` or the fields' own
 * relationship. A page showing `allotted` and `completed` but not `forfeited`
 * cannot be read — the difference has to go somewhere, and it went nowhere.
 *
 * Pure, and takes the rows rather than fetching: `studentsWithHours()` has
 * already done the work, and every caller has the rows in hand.
 *
 * @param rows students as `studentsWithHours()` returns them
 */
export function programTotals(rows: readonly StudentHoursRow[]): ProgramTotals {
  const totals: ProgramTotals = {
    students: rows.length,
    allotted: 0,
    completed: 0,
    missed: 0,
    remaining: 0,
    forfeited: 0,
    extra: 0,
    paid: 0,
    overdrawn: 0,
  };
  for (const row of rows) {
    totals.allotted += row.allottedMinutes;
    totals.completed += row.completedMinutes;
    totals.missed += row.missedMinutes;
    totals.remaining += row.remainingMinutes;
    totals.forfeited += row.forfeitedMinutes;
    totals.extra += row.extraMinutes;
    totals.paid += row.amountPaid;
    if (row.remainingMinutes < 0) totals.overdrawn += 1;
  }
  return totals;
}

/** The fields of a `StudentWithHours` that a total is built from. */
export type StudentHoursRow = {
  allottedMinutes: number;
  completedMinutes: number;
  missedMinutes: number;
  remainingMinutes: number;
  forfeitedMinutes: number;
  extraMinutes: number;
  amountPaid: number;
};

export type ProgramTotals = {
  students: number;
  allotted: number;
  /** Time delivered: used minus no-shows. */
  completed: number;
  /** No-show minutes. Charged, and inside `completed`'s complement. */
  missed: number;
  /** `allotted − used − forfeited`. Negative when students are overdrawn. */
  remaining: number;
  /** Unused minutes lost to a passed deadline. */
  forfeited: number;
  /** Out-of-plan minutes: delivered, and outside every figure above. */
  extra: number;
  /** Dollars, for programs that track payment. */
  paid: number;
  /** How many of these students are past their allocation. */
  overdrawn: number;
};
