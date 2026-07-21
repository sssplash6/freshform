import "server-only";

import { prisma } from "@/lib/prisma";
import { SESSION_STATUS } from "@/lib/constants";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Students with their derived hour totals, in one round trip per collection
 * (profiles + grouped sums over allocations and ACTIVE sessions), not one
 * query per student. allottedHours = sum of the student's per-mentor
 * allocations.
 */
export async function studentsWithHours(
  where: Prisma.StudentProfileWhereInput = {}
) {
  const profiles = await prisma.studentProfile.findMany({
    where,
    include: {
      user: true,
      program: true,
      cohort: true,
    },
    orderBy: [{ program: { name: "asc" } }, { createdAt: "asc" }],
  });
  const ids = profiles.map((p) => p.id);

  const [allocationSums, sessionSums] = await Promise.all([
    prisma.hourAllocation.groupBy({
      by: ["studentId"],
      where: { studentId: { in: ids } },
      _sum: { hours: true },
    }),
    prisma.session.groupBy({
      by: ["studentId", "attended"],
      where: { status: SESSION_STATUS.ACTIVE, studentId: { in: ids } },
      _sum: { hours: true },
    }),
  ]);
  const allottedById = new Map(
    allocationSums.map((s) => [s.studentId, s._sum.hours ?? 0])
  );
  // Used = every active session (present + no-show); missed = the no-show subset.
  const usedById = new Map<string, number>();
  const missedById = new Map<string, number>();
  for (const s of sessionSums) {
    const hrs = s._sum.hours ?? 0;
    usedById.set(s.studentId, (usedById.get(s.studentId) ?? 0) + hrs);
    if (!s.attended) {
      missedById.set(s.studentId, (missedById.get(s.studentId) ?? 0) + hrs);
    }
  }

  return profiles.map((profile) => {
    const allotted = allottedById.get(profile.id) ?? 0;
    const used = usedById.get(profile.id) ?? 0;
    const missed = missedById.get(profile.id) ?? 0;
    return {
      ...profile,
      allottedHours: allotted,
      completedHours: used - missed,
      missedHours: missed,
      remainingHours: allotted - used,
    };
  });
}

export type StudentWithHours = Awaited<
  ReturnType<typeof studentsWithHours>
>[number];

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
 * The distinct mentors working in a program (assigned program-wide or to any
 * of its cohorts) — the pool an admin may allocate a student's hours from.
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
