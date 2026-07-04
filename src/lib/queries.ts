import "server-only";

import { prisma } from "@/lib/prisma";
import { SESSION_STATUS } from "@/lib/constants";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Students with their derived hour totals, in one round trip per collection
 * (profiles + a grouped sum over ACTIVE sessions), not one query per student.
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

  const sums = await prisma.session.groupBy({
    by: ["studentId"],
    where: {
      status: SESSION_STATUS.ACTIVE,
      studentId: { in: profiles.map((p) => p.id) },
    },
    _sum: { hours: true },
  });
  const completedById = new Map(
    sums.map((s) => [s.studentId, s._sum.hours ?? 0])
  );

  return profiles.map((profile) => {
    const completed = completedById.get(profile.id) ?? 0;
    return {
      ...profile,
      completedHours: completed,
      remainingHours: profile.allottedHours - completed,
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

/** All cohorts grouped for select inputs, optionally limited to a program. */
export async function cohortOptions(programId?: string) {
  return prisma.cohort.findMany({
    where: programId ? { programId } : {},
    include: { program: true },
    orderBy: [{ program: { name: "asc" } }, { name: "asc" }],
  });
}
