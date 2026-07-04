import { prisma } from "@/lib/prisma";
import { SESSION_STATUS } from "@/lib/constants";

/**
 * Derived hour values (spec §5): never stored as mutable counters.
 *  - completedHours = sum of hours over the student's ACTIVE sessions
 *  - remainingHours = allottedHours − completedHours
 */

export async function completedHours(studentProfileId: string): Promise<number> {
  const result = await prisma.session.aggregate({
    where: { studentId: studentProfileId, status: SESSION_STATUS.ACTIVE },
    _sum: { hours: true },
  });
  return result._sum.hours ?? 0;
}

export async function hoursSummary(studentProfileId: string) {
  const profile = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: studentProfileId },
  });
  const completed = await completedHours(studentProfileId);
  return {
    allotted: profile.allottedHours,
    completed,
    remaining: profile.allottedHours - completed,
  };
}
