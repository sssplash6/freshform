import type { MentorFeedbackGroup } from "@/components/mentor-feedback-list";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/** Comments shown per mentor before the card says "and N more". */
export const COMMENTS_PER_MENTOR = 6;

/**
 * One page of mentors who have been rated, loudest first, each with their true
 * average over all their ratings and only their most recent comments.
 *
 * Split out because the admin and the department-leader views want exactly this
 * shape and differ only in which mentors they may see. Both used to read every
 * rating in the table on every visit.
 */
export async function mentorFeedbackGroups(
  where: Prisma.MentorFeedbackWhereInput,
  { skip, take }: { skip: number; take: number },
): Promise<{ groups: MentorFeedbackGroup[]; mentors: number }> {
  const [byMentor, distinctMentors] = await Promise.all([
    prisma.mentorFeedback.groupBy({
      by: ["mentorId"],
      where,
      _avg: { rating: true },
      _count: { _all: true },
      orderBy: { _count: { mentorId: "desc" } },
      skip,
      take,
    }),
    prisma.mentorFeedback.groupBy({ by: ["mentorId"], where }),
  ]);

  const groups = await Promise.all(
    byMentor.map(async (row) => {
      // Per-mentor, because "the latest six for each" is not something one
      // query can express against SQLite.
      const [mentor, rows] = await Promise.all([
        prisma.user.findUnique({ where: { id: row.mentorId } }),
        prisma.mentorFeedback.findMany({
          where: { AND: [where, { mentorId: row.mentorId }] },
          include: { student: { include: { user: true } } },
          orderBy: { createdAt: "desc" },
          take: COMMENTS_PER_MENTOR,
        }),
      ]);
      if (!mentor) return null;
      return {
        mentor,
        average: row._avg.rating ?? 0,
        total: row._count._all,
        rows,
      };
    }),
  );

  return {
    groups: groups.filter((g): g is MentorFeedbackGroup => g !== null),
    mentors: distinctMentors.length,
  };
}
