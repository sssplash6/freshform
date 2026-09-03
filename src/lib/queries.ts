import "server-only";

import { prisma } from "@/lib/prisma";
import {
  ASSIGNMENT_PROGRESS,
  CHARGED_SESSION,
  SESSION_STATUS,
  USER_STATUS,
} from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import { deadlinePassed } from "@/lib/deadlines";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Students with their derived hour totals, in one round trip per collection
 * (profiles + grouped sums over allocations and ACTIVE sessions), not one
 * query per student. allottedMinutes = sum of the student's per-mentor
 * allocations.
 *
 * `slice` narrows it to one page. The derived totals are then computed for that
 * page only — which is the point: the grouped sums are keyed by the ids that
 * came back, so a page of twenty-five students costs the same three queries
 * whether the school has thirty students or three thousand.
 */
export async function studentsWithHours(
  where: Prisma.StudentProfileWhereInput = {},
  slice?: { skip: number; take: number },
  /**
   * The instant forfeiture is judged against.
   *
   * A parameter rather than a call to the clock, so a page that hands one
   * `now` to every component cannot get a different answer from its own
   * query — the impurity `status.ts` exists to remove, and the reason the
   * HoursRing and the ledger once disagreed by 4h 38m. Defaulted, because
   * every existing caller means "right now".
   */
  now: Date = new Date()
) {
  const profiles = await prisma.studentProfile.findMany({
    where,
    include: {
      user: true,
      program: true,
      cohort: true,
    },
    orderBy: [{ program: { name: "asc" } }, { createdAt: "asc" }],
    ...(slice ?? {}),
  });
  const ids = profiles.map((p) => p.id);

  const [allocations, sessionSums] = await Promise.all([
    prisma.hourAllocation.findMany({
      where: { studentId: { in: ids } },
      select: {
        studentId: true,
        mentorId: true,
        minutes: true,
        deadline: true,
        amountPaid: true,
      },
    }),
    prisma.session.groupBy({
      by: ["studentId", "mentorId", "attended", "withinPlan"],
      where: { status: SESSION_STATUS.ACTIVE, studentId: { in: ids } },
      _sum: { minutes: true },
    }),
  ]);

  // Used = every CHARGING session (present + no-show); missed = the no-show
  // subset. usedByPair drives per-allocation forfeiture on expired deadlines.
  // Out-of-plan hours are counted apart: they were delivered, but they draw
  // nothing down, so folding them in here would understate every balance.
  const usedById = new Map<string, number>();
  const missedById = new Map<string, number>();
  const extraById = new Map<string, number>();
  const usedByPair = new Map<string, number>();
  for (const s of sessionSums) {
    const hrs = s._sum.minutes ?? 0;
    if (!s.withinPlan) {
      extraById.set(s.studentId, (extraById.get(s.studentId) ?? 0) + hrs);
      continue;
    }
    usedById.set(s.studentId, (usedById.get(s.studentId) ?? 0) + hrs);
    usedByPair.set(
      `${s.studentId}:${s.mentorId}`,
      (usedByPair.get(`${s.studentId}:${s.mentorId}`) ?? 0) + hrs
    );
    if (!s.attended) {
      missedById.set(s.studentId, (missedById.get(s.studentId) ?? 0) + hrs);
    }
  }

    // allotted per student, plus forfeited hours from allocations past deadline.
  const at = now.getTime();
  const allottedById = new Map<string, number>();
  // The soonest use-by date that still has time behind it. Expiry is only
  // worth warning about while the hours can still be spent, so a passed
  // deadline is not a candidate — those minutes are already forfeited above.
  const nextDeadlineById = new Map<string, Date>();
  const forfeitedById = new Map<string, number>();
  const paidById = new Map<string, number>();
  for (const a of allocations) {
    allottedById.set(a.studentId, (allottedById.get(a.studentId) ?? 0) + a.minutes);
    if (a.amountPaid != null) {
      paidById.set(a.studentId, (paidById.get(a.studentId) ?? 0) + a.amountPaid);
    }
        if (a.deadline.getTime() < at) {
      const used = usedByPair.get(`${a.studentId}:${a.mentorId}`) ?? 0;
      const forfeited = Math.max(0, a.minutes - used);
      if (forfeited > 0) {
        forfeitedById.set(
          a.studentId,
          (forfeitedById.get(a.studentId) ?? 0) + forfeited
        );
      }
    } else {
      const soonest = nextDeadlineById.get(a.studentId);
      if (!soonest || a.deadline < soonest) {
        nextDeadlineById.set(a.studentId, a.deadline);
      }
    }
  }

  return profiles.map((profile) => {
    const allotted = allottedById.get(profile.id) ?? 0;
    const used = usedById.get(profile.id) ?? 0;
    const missed = missedById.get(profile.id) ?? 0;
    const forfeited = forfeitedById.get(profile.id) ?? 0;
    return {
      ...profile,
      allottedMinutes: allotted,
      completedMinutes: used - missed,
      missedMinutes: missed,
      extraMinutes: extraById.get(profile.id) ?? 0,
      forfeitedMinutes: forfeited,
            amountPaid: paidById.get(profile.id) ?? 0,
      remainingMinutes: allotted - used - forfeited,
      nextDeadline: nextDeadlineById.get(profile.id) ?? null,
    };
  });
}

export type StudentWithHours = Awaited<
  ReturnType<typeof studentsWithHours>
>[number];

/**
 * The two halves of one student's ledger: the meetings log (every mentor's
 * sessions, newest first) and the assignment plan (in its own order). Everyone
 * who can see the student sees the whole log, not just their own slice — the
 * spreadsheet this replaces was shared, and a mentor picking up an essay needs
 * to know what the last three meetings covered.
 */
export async function studentLedger(studentProfileId: string) {
  const [sessions, assignments] = await Promise.all([
    prisma.session.findMany({
      where: { studentId: studentProfileId },
      include: { mentor: true, assignment: { select: { id: true, purpose: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.assignment.findMany({
      where: { studentId: studentProfileId },
      include: { mentor: true },
      orderBy: { position: "asc" },
    }),
  ]);

  // Hours actually delivered against each goal, so a plan can be read against
  // reality. ACTIVE only: voided sessions returned their time. Out-of-plan
  // hours DO count here — a task's hour limit budgets the work, and work done
  // for free is still work done on the essay.
  const loggedByGoal = new Map<string, number>();
  for (const session of sessions) {
    if (!session.assignmentId || session.status !== SESSION_STATUS.ACTIVE) continue;
    loggedByGoal.set(
      session.assignmentId,
      (loggedByGoal.get(session.assignmentId) ?? 0) + session.minutes
    );
  }

  return {
    sessions,
    assignments: assignments.map((a) => ({
      ...a,
      loggedMinutes: loggedByGoal.get(a.id) ?? 0,
    })),
  };
}

export type LedgerSession = Awaited<
  ReturnType<typeof studentLedger>
>["sessions"][number];

/**
 * One student's scheduled meetings, whoever booked them, newest date first.
 * Everyone who can see the student sees all of them — the same reasoning as the
 * meetings log: a mentor picking up an essay should know the student already
 * has a mock interview on Thursday with someone else.
 *
 * Callers bucket these with `splitMeetings` (lib/interviews.ts) rather than
 * filtering by date here, so "upcoming" means the same thing on every page.
 */
export async function studentMeetings(studentProfileId: string) {
  return prisma.interview.findMany({
    where: { studentId: studentProfileId },
    include: { mentor: true },
    orderBy: { scheduledAt: "desc" },
  });
}

export type StudentMeeting = Awaited<
  ReturnType<typeof studentMeetings>
>[number];

/**
 * A mentor's own diary: every meeting they have on the books, with the student
 * on it. Not date-filtered for the same reason as `studentMeetings` — the
 * overdue ones are exactly what a mentor's dashboard needs to surface.
 */
export async function mentorMeetings(mentorId: string) {
  return prisma.interview.findMany({
    where: { mentorId },
    include: { mentor: true, student: { include: { user: true } } },
    orderBy: { scheduledAt: "desc" },
  });
}

export type MentorMeeting = Awaited<ReturnType<typeof mentorMeetings>>[number];

/**
 * The most recent meetings across students, for the log that leads a dashboard.
 * Scoped to one mentor when given, otherwise every program's sessions.
 */
export async function recentMeetings({
  mentorId,
  programId,
  take = 8,
}: {
  mentorId?: string;
  programId?: string;
  take?: number;
} = {}) {
    return prisma.session.findMany({
    where: {
      ...(mentorId ? { mentorId } : {}),
      ...(programId ? { student: { programId } } : {}),
    },
        include: {
      mentor: true,
      // The program comes along because a one-line session row names it —
      // "Malika logged 90 min with Aziza · Master's Program" — and looking it
      // up separately meant a second query for a string already one join away.
      student: { include: { user: true, program: true } },
      assignment: { select: { id: true, purpose: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
  });
}

export type LedgerAssignment = Awaited<
  ReturnType<typeof studentLedger>
>["assignments"][number];

/**
 * Every task in a program with the hours logged against it — the program's work
 * in flight. Unfinished tasks come first, then the sheet's own order, so a
 * dashboard can show what is outstanding without filtering client-side.
 */
export async function programTasks(programId: string) {
  const tasks = await prisma.assignment.findMany({
    where: { student: { programId } },
    include: {
      mentor: true,
      student: { include: { user: true } },
    },
    orderBy: [{ studentId: "asc" }, { position: "asc" }],
  });
  if (tasks.length === 0) return [];

  const logged = await prisma.session.groupBy({
    by: ["assignmentId"],
    where: {
      status: SESSION_STATUS.ACTIVE,
      assignmentId: { in: tasks.map((t) => t.id) },
    },
    _sum: { minutes: true },
  });
  const loggedById = new Map(
    logged.map((l) => [l.assignmentId ?? "", l._sum.minutes ?? 0])
  );

  return tasks
    .map((task) => ({ ...task, loggedMinutes: loggedById.get(task.id) ?? 0 }))
    .sort((a, b) => {
      // Stable sort, so unfinished work floats up and each student's own order
      // survives underneath.
      const aDone = a.progress === ASSIGNMENT_PROGRESS.DONE ? 1 : 0;
      const bDone = b.progress === ASSIGNMENT_PROGRESS.DONE ? 1 : 0;
      return aDone - bDone;
    });
}

export type ProgramTask = Awaited<ReturnType<typeof programTasks>>[number];

/**
 * The tasks each logged session could be attached to: the ones its own mentor
 * holds for its own student. Keyed by session id, because a log can span
 * students and mentors — the dashboard's does — and a correction menu needs the
 * right handful, not all of them.
 *
 * One query for the whole log, not one per row.
 */
export async function taskOptionsForSessions(
  sessions: { id: string; studentId: string; mentorId: string }[]
): Promise<Record<string, { value: string; label: string }[]>> {
  if (sessions.length === 0) return {};

  const tasks = await prisma.assignment.findMany({
    where: { studentId: { in: [...new Set(sessions.map((s) => s.studentId))] } },
    orderBy: { position: "asc" },
    select: {
      id: true,
      studentId: true,
      mentorId: true,
      purpose: true,
      progress: true,
    },
  });

  const byPair = new Map<string, { value: string; label: string }[]>();
  for (const task of tasks) {
    const key = `${task.studentId}:${task.mentorId}`;
    const list = byPair.get(key) ?? [];
    // Done tasks stay pickable: a session may be the last one against work an
    // admin has already ticked off, and hiding it would strand the correction.
    list.push({
      value: task.id,
      label:
        task.progress === ASSIGNMENT_PROGRESS.DONE
          ? `${task.purpose} (done)`
          : task.purpose,
    });
    byPair.set(key, list);
  }

  const bySession: Record<string, { value: string; label: string }[]> = {};
  for (const session of sessions) {
    const list = byPair.get(`${session.studentId}:${session.mentorId}`);
    if (list) bySession[session.id] = list;
  }
  return bySession;
}

/**
 * The programs (and, for Global Admissions, cohorts) a mentor is assigned
 * to, with booking links. cohort is null for program-wide assignments.
 */
export async function mentorAssignments(mentorId: string) {
  return prisma.mentorAssignment.findMany({
    where: { mentorId },
    include: { program: true, cohort: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Every program a mentor touches: assigned to, holding hours in, or having
 * logged a session in. Assignment alone isn't enough — a mentor moved off a
 * program still has its history — so the filter offers all three.
 */
export async function mentorPrograms(mentorId: string) {
  return prisma.program.findMany({
    where: {
      OR: [
        { mentorAssignments: { some: { mentorId } } },
        { students: { some: { hourAllocations: { some: { mentorId } } } } },
        { students: { some: { sessions: { some: { mentorId } } } } },
      ],
    },
    orderBy: { name: "asc" },
  });
}

/** How a mentor's hours are being read: which program, and over what dates. */
export type MentorHoursWindow = {
  programId?: string;
  from?: Date;
  to?: Date;
};

/**
 * One mentor's whole picture for the admin's mentor page: the students holding
 * hours from them, the sessions inside the chosen window, and both rolled up
 * per program.
 *
 * Two kinds of number live here and the difference is deliberate. BALANCES
 * (allocated, remaining, forfeited) weigh allocations against every active
 * session ever logged — a balance has no date range. DELIVERED and MISSED are
 * hours inside the window. The program filter narrows both halves; the dates
 * only move the window, which is why the page labels the two apart.
 */
export async function mentorOverview(
  mentorId: string,
  { programId, from, to }: MentorHoursWindow = {}
) {
  const inProgram = programId ? { student: { programId } } : {};
  const inWindow =
    from || to
      ? {
          date: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {};

  const [allocations, lifetimeSums, sessions] = await Promise.all([
    prisma.hourAllocation.findMany({
      where: { mentorId, ...inProgram },
      include: {
        student: { include: { user: true, program: true, cohort: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Balances draw on every charging session this mentor ever logged, not just
    // the ones the window happens to show.
    prisma.session.groupBy({
      by: ["studentId", "attended"],
      where: { mentorId, ...CHARGED_SESSION },
      _sum: { minutes: true },
    }),
    prisma.session.findMany({
      where: { mentorId, ...inProgram, ...inWindow },
      include: {
        mentor: true,
        student: { include: { user: true, program: true } },
        assignment: { select: { id: true, purpose: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const usedByStudent = new Map<string, number>();
  const missedByStudent = new Map<string, number>();
  for (const s of lifetimeSums) {
    const hrs = s._sum.minutes ?? 0;
    usedByStudent.set(s.studentId, (usedByStudent.get(s.studentId) ?? 0) + hrs);
    if (!s.attended) {
      missedByStudent.set(
        s.studentId,
        (missedByStudent.get(s.studentId) ?? 0) + hrs
      );
    }
  }

  // Same forfeiture rule as lib/hours.ts: once the use-by date passes, unused
  // hours are gone and only an overdraw survives as "remaining".
  const students = allocations.map((a) => {
    const used = usedByStudent.get(a.studentId) ?? 0;
    const missed = missedByStudent.get(a.studentId) ?? 0;
    const expired = deadlinePassed(a.deadline);
    return {
      student: a.student,
      allocated: a.minutes,
      used,
      completed: used - missed,
      missed,
      remaining: expired ? Math.min(0, a.minutes - used) : a.minutes - used,
      forfeited: expired ? Math.max(0, a.minutes - used) : 0,
      expired,
      deadline: a.deadline,
      amountPaid: a.amountPaid,
    };
  });

  const active = sessions.filter((s) => s.status === SESSION_STATUS.ACTIVE);

  type ProgramRow = {
    id: string;
    name: string;
    students: number;
    allocated: number;
    used: number;
    forfeited: number;
    remaining: number;
    delivered: number;
    missed: number;
    /** Hours given out of plan in the window — delivered, but charged to nobody. */
    extra: number;
    sessions: number;
  };
  const rows = new Map<string, ProgramRow>();
  const rowFor = (id: string, name: string) => {
    const existing = rows.get(id);
    if (existing) return existing;
    const fresh: ProgramRow = {
      id,
      name,
      students: 0,
      allocated: 0,
      used: 0,
      forfeited: 0,
      remaining: 0,
      delivered: 0,
      missed: 0,
      extra: 0,
      sessions: 0,
    };
    rows.set(id, fresh);
    return fresh;
  };
  for (const s of students) {
    const row = rowFor(s.student.programId, s.student.program.name);
    row.students += 1;
    row.allocated += s.allocated;
    row.used += s.used;
    row.forfeited += s.forfeited;
    row.remaining += s.remaining;
  }
  // A session can outlive its allocation (an admin may remove one), so the
  // window's hours land in their program's row either way.
  for (const s of active) {
    const row = rowFor(s.student.programId, s.student.program.name);
    row.sessions += 1;
    if (!s.withinPlan) row.extra += s.minutes;
    else if (s.attended) row.delivered += s.minutes;
    else row.missed += s.minutes;
  }

  const sum = (pick: (row: ProgramRow) => number) =>
    [...rows.values()].reduce((total, row) => total + pick(row), 0);

  return {
    students,
    sessions,
    byProgram: [...rows.values()].sort((a, b) => a.name.localeCompare(b.name)),
    totals: {
      students: students.length,
      sessions: active.length,
      delivered: sum((r) => r.delivered),
      missed: sum((r) => r.missed),
      extra: sum((r) => r.extra),
      allocated: sum((r) => r.allocated),
      forfeited: sum((r) => r.forfeited),
      remaining: sum((r) => r.remaining),
    },
  };
}

export type MentorOverview = Awaited<ReturnType<typeof mentorOverview>>;

/**
 * The distinct mentors working in a program (assigned program-wide or to any
 * of its cohorts) — the pool an admin may allocate a student's time from.
 */
export async function mentorsInProgram(programId: string) {
  const assignments = await prisma.mentorAssignment.findMany({
    where: { programId },
    include: { mentor: true },
    orderBy: { createdAt: "asc" },
  });
  const seen = new Set<string>();
  return assignments
    .map((a) => a.mentor)
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

/**
 * The mentor assignments visible to one student: program-wide assignments in
 * their program, plus their own cohort's assignments if they're in one.
 */
export function assignmentsForStudentWhere(profile: {
  programId: string;
  cohortId: string | null;
}): Prisma.MentorAssignmentWhereInput {
  return {
    programId: profile.programId,
    OR: [
      { cohortId: null },
      ...(profile.cohortId ? [{ cohortId: profile.cohortId }] : []),
    ],
  };
}

/**
 * All programs with their cohorts, for enrollment/assignment selects. Only
 * programs with cohorts (Global Admissions) require picking one.
 */
export async function programOptions() {
  return prisma.program.findMany({
    include: { cohorts: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
}

/** Shape passed to the client-side enrollment forms. */
export type ProgramOption = {
  id: string;
  name: string;
  cohorts: { id: string; name: string }[];
};

export function toProgramOptions(
  programs: Awaited<ReturnType<typeof programOptions>>
): ProgramOption[] {
  return programs.map((p) => ({
    id: p.id,
    name: p.name,
    cohorts: p.cohorts.map((c) => ({ id: c.id, name: c.name })),
  }));
}

/**
 * One mentor's caseload — the answer to "who are my students?", once.
 *
 * The rule was written four times, in four shapes, in four files
 * (`interviews.ts:46-74`, `sessions.ts:229-275`, `mentor/students/[id]`,
 * `admin/students/[id]`), and a fifth copy — 250 lines of it — lived inside the
 * `/mentor` page component, which is why `/sessions/new` could not exist: the
 * only place that knew which students a mentor may log for was a page body.
 *
 * A mentor REACHES a student four ways, and each is here for a reason:
 *
 *   allocation   an admin granted this mentor time with them. This alone is
 *                authorization, and it outlives a program assignment that later
 *                moves, so hours already delivered can always be corrected.
 *   pool         the student holds unassigned time in a program this mentor
 *                works in. Logging is what decides whose time it was.
 *   ever met     a logged session, even with no allocation — a grant may be
 *                removed after the fact, and the meeting still happened.
 *   in program   everyone else in a program (and cohort) this mentor is
 *                assigned to. Not their student, and in no total: reachable
 *                only so a meeting that happened before any grant existed can
 *                still be recorded.
 *
 * Today `/mentor` shows a mentor with no allocations zero students while the
 * log picker offers eleven. The first three groups are `students`, the fourth
 * is `loggable`, and both come back so a caller can decide which it needs.
 */
export type CaseloadStudent = {
  profile: {
    id: string;
    programId: string;
    cohortId: string | null;
    telegramUsername: string | null;
    folderUrl: string | null;
    user: { name: string | null; email: string; status: string };
    program: { name: string };
    cohort: { name: string } | null;
  };
  allocated: number;
  completed: number;
  missed: number;
  /** Delivered on top of the plan: outside every total, but real work. */
  extra: number;
  remaining: number;
  deadline: Date | null;
  expired: boolean;
  approved: boolean;
  /** Unassigned hours this student holds; only when the mentor has no grant. */
  pool?: number;
  /** How this mentor reaches them, for a list that sorts by closeness. */
  reach: "allocation" | "pool" | "met";
};

export type MentorCaseload = {
  students: CaseloadStudent[];
  /** In the mentor's programs, but not theirs: pickable, never totalled. */
  loggable: {
    id: string;
    programId: string;
    user: { name: string | null; email: string };
    program: { name: string };
  }[];
  /** studentId → the tasks this mentor may log against for them. */
  goalsByStudent: Map<string, { value: string; label: string }[]>;
  assignments: Awaited<ReturnType<typeof mentorAssignments>>;
  /** Lifetime figures for this mentor, across every program. */
  delivered: { minutes: number; missed: number; extra: number; sessions: number };
};

export async function mentorCaseload(mentorId: string): Promise<MentorCaseload> {
  const [assignments, allocations, poolAllocations, mySessionSums, lifetime, myGoals] =
    await Promise.all([
      mentorAssignments(mentorId),
      prisma.hourAllocation.findMany({
        where: { mentorId },
        include: { student: { include: { user: true, program: true, cohort: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.hourAllocation.findMany({
        where: { mentorId: null },
        include: { student: { include: { user: true, program: true, cohort: true } } },
        orderBy: { createdAt: "asc" },
      }),
      // Split by plan: in-plan rows are the balances (out-of-plan hours never
      // shrink what a student holds), and the whole set names everyone this
      // mentor has met — including students they only ever gave extra time to.
      prisma.session.groupBy({
        by: ["studentId", "attended", "withinPlan"],
        where: { mentorId, status: SESSION_STATUS.ACTIVE },
        _sum: { minutes: true },
      }),
      prisma.session.groupBy({
        by: ["attended", "withinPlan"],
        where: { mentorId, status: SESSION_STATUS.ACTIVE },
        _sum: { minutes: true },
        _count: true,
      }),
      // Tasks an admin gave THIS mentor, plus tasks with no mentor yet —
      // logging against an unassigned one is how it becomes theirs.
      prisma.assignment.findMany({
        where: { OR: [{ mentorId }, { mentorId: null }] },
        orderBy: [{ studentId: "asc" }, { position: "asc" }],
        select: { id: true, studentId: true, mentorId: true, purpose: true, progress: true },
      }),
    ]);

  const goalsByStudent = new Map<string, { value: string; label: string }[]>();
  for (const g of myGoals) {
    const list = goalsByStudent.get(g.studentId) ?? [];
    // Done tasks stay pickable: a mentor may log a final session for work an
    // admin already ticked off, and hiding it would strand those hours.
    list.push({
      value: g.id,
      label:
        g.progress === ASSIGNMENT_PROGRESS.DONE
          ? `${g.purpose} (done)`
          : g.mentorId === null
            ? `${g.purpose} (unassigned)`
            : g.purpose,
    });
    goalsByStudent.set(g.studentId, list);
  }

  const used = new Map<string, number>();
  const missedBy = new Map<string, number>();
  const extraBy = new Map<string, number>();
  for (const s of mySessionSums) {
    const minutes = s._sum.minutes ?? 0;
    if (!s.withinPlan) {
      extraBy.set(s.studentId, (extraBy.get(s.studentId) ?? 0) + minutes);
      continue;
    }
    used.set(s.studentId, (used.get(s.studentId) ?? 0) + minutes);
    if (!s.attended) missedBy.set(s.studentId, (missedBy.get(s.studentId) ?? 0) + minutes);
  }

  const students: CaseloadStudent[] = allocations.map((a) => {
    const drawn = used.get(a.studentId) ?? 0;
    const missed = missedBy.get(a.studentId) ?? 0;
    const expired = deadlinePassed(a.deadline);
    return {
      profile: a.student,
      allocated: a.minutes,
      completed: drawn - missed,
      missed,
      extra: extraBy.get(a.studentId) ?? 0,
      // Unused hours on an expired allocation are forfeited.
      remaining: expired ? Math.min(0, a.minutes - drawn) : a.minutes - drawn,
      deadline: a.deadline,
      expired,
      approved: a.student.user.status === USER_STATUS.ACTIVE,
      reach: "allocation",
    };
  });

  const inScope = (s: { programId: string; cohortId: string | null }) =>
    assignments.some(
      (a) => a.programId === s.programId && (!a.cohortId || a.cohortId === s.cohortId)
    );

  // Skipped once the mentor holds their own grant (that row already exists, and
  // their sessions draw their own hours), and once the pool is empty or
  // expired — there is nothing left to log against.
  const mine = new Set(allocations.map((a) => a.studentId));
  for (const p of poolAllocations) {
    if (mine.has(p.studentId)) continue;
    if (p.minutes <= 0 || deadlinePassed(p.deadline)) continue;
    if (!inScope(p.student)) continue;
    students.push({
      profile: p.student,
      allocated: 0,
      completed: 0,
      missed: 0,
      extra: extraBy.get(p.studentId) ?? 0,
      remaining: 0,
      deadline: p.deadline,
      expired: false,
      approved: p.student.user.status === USER_STATUS.ACTIVE,
      pool: p.minutes,
      reach: "pool",
    });
  }

  const listed = new Set(students.map((s) => s.profile.id));
  const metIds = [...new Set(mySessionSums.map((s) => s.studentId))].filter(
    (id) => !listed.has(id)
  );
  const met = metIds.length
    ? await prisma.studentProfile.findMany({
        where: { id: { in: metIds } },
        include: { user: true, program: true, cohort: true },
      })
    : [];
  for (const p of met) {
    const drawn = used.get(p.id) ?? 0;
    const missed = missedBy.get(p.id) ?? 0;
    listed.add(p.id);
    students.push({
      profile: p,
      allocated: 0,
      completed: drawn - missed,
      missed,
      extra: extraBy.get(p.id) ?? 0,
      // Nothing was allotted, so every charged minute is the overdraw it is.
      remaining: -drawn,
      deadline: null,
      expired: false,
      approved: p.user.status === USER_STATUS.ACTIVE,
      reach: "met",
    });
  }

  const loggable = assignments.length
    ? await prisma.studentProfile.findMany({
        where: {
          id: { notIn: [...listed] },
          user: { status: USER_STATUS.ACTIVE },
          OR: assignments.map((a) =>
            a.cohortId
              ? { programId: a.programId, cohortId: a.cohortId }
              : { programId: a.programId }
          ),
        },
        include: { user: true, program: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const sum = (rows: typeof lifetime) =>
    rows.reduce((n, d) => n + (d._sum.minutes ?? 0), 0);

  return {
    students,
    loggable,
    goalsByStudent,
    assignments,
    delivered: {
      minutes: sum(lifetime.filter((d) => d.withinPlan && d.attended)),
      missed: sum(lifetime.filter((d) => d.withinPlan && !d.attended)),
      extra: sum(lifetime.filter((d) => !d.withinPlan)),
      sessions: lifetime.reduce((n, d) => n + d._count, 0),
    },
  };
}

/**
 * The log-a-session picker's options, in the order a mentor picks them.
 *
 * Students holding live time first, because that is who a mentor is logging
 * for on a normal Monday; everyone else in their programs last, because that
 * pick exists for the meeting that happened before any hours were granted.
 * Both lines are searchable, so an email is there to be typed at, not read.
 */
export function logSessionOptions(caseload: MentorCaseload) {
  const { students, loggable, goalsByStudent } = caseload;
  return [
    ...students
      .filter((s) => s.approved && !s.expired)
      .map((s) => ({
        profileId: s.profile.id,
        label: s.profile.user.name ?? s.profile.user.email,
        hint:
          s.pool != null
            ? `${formatDuration(s.pool)} unassigned — logging makes them yours · ${s.profile.program.name} · ${s.profile.user.email}`
            : s.allocated > 0
              ? `${formatDuration(s.remaining)} left with you · ${s.profile.program.name} · ${s.profile.user.email}`
              : `No time allocated to you · ${s.profile.program.name} · ${s.profile.user.email}`,
                // Shown under the closed select, where the dropdown's searchable hint
        // is no longer visible and the one thing a mentor re-checks before
        // typing minutes is how much time there is to spend.
        balance:
          s.pool != null
            ? `${formatDuration(s.pool)} unassigned — logging makes it yours`
            : s.allocated > 0
              ? `${formatDuration(s.remaining)} left with you`
              : "No time allocated to you",
        goals: goalsByStudent.get(s.profile.id) ?? [],
      })),
    ...loggable.map((p) => ({
      profileId: p.id,
      label: p.user.name ?? p.user.email,
      hint: `No time allocated to you · ${p.program.name} · ${p.user.email}`,
      balance: "No time allocated to you",
      goals: goalsByStudent.get(p.id) ?? [],
    })),
  ];
}
