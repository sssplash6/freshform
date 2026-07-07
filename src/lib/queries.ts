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
      cohort: { include: { program: true } },
    },
    orderBy: [{ cohort: { program: { name: "asc" } } }, { createdAt: "asc" }],
  });
  const ids = profiles.map((p) => p.id);

  const [allocationSums, sessionSums] = await Promise.all([
    prisma.hourAllocation.groupBy({
      by: ["studentId"],
      where: { studentId: { in: ids } },
      _sum: { hours: true },
    }),
    prisma.session.groupBy({
      by: ["studentId"],
      where: { status: SESSION_STATUS.ACTIVE, studentId: { in: ids } },
      _sum: { hours: true },
    }),
  ]);
  const allottedById = new Map(
    allocationSums.map((s) => [s.studentId, s._sum.hours ?? 0])
  );
  const completedById = new Map(
    sessionSums.map((s) => [s.studentId, s._sum.hours ?? 0])
  );

  return profiles.map((profile) => {
    const allotted = allottedById.get(profile.id) ?? 0;
    const completed = completedById.get(profile.id) ?? 0;
    return {
      ...profile,
      allottedHours: allotted,
      completedHours: completed,
      remainingHours: allotted - completed,
    };
  });
}

export type StudentWithHours = Awaited<
  ReturnType<typeof studentsWithHours>
>[number];

/** The cohorts a mentor is assigned to, with booking links. */
export async function mentorAssignments(mentorId: string) {
  return prisma.mentorAssignment.findMany({
    where: { mentorId },
    include: { cohort: { include: { program: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * The distinct mentors working in a program (i.e. assigned to any of its
 * cohorts) — the pool an admin may allocate a student's hours from.
 */
export async function mentorsInProgram(programId: string) {
  const assignments = await prisma.mentorAssignment.findMany({
    where: { cohort: { programId } },
    include: { mentor: true },
    orderBy: { createdAt: "asc" },
  });
  const seen = new Set<string>();
  return assignments
    .map((a) => a.mentor)
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

/** All cohorts grouped for select inputs, optionally limited to a program. */
export async function cohortOptions(programId?: string) {
  return prisma.cohort.findMany({
    where: programId ? { programId } : {},
    include: { program: true },
    orderBy: [{ program: { name: "asc" } }, { name: "asc" }],
  });
}
