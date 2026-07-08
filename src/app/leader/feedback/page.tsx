import { MentorFeedbackList } from "@/components/mentor-feedback-list";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/** Dept Leader: feedback for mentors assigned within their program only. */
export default async function LeaderFeedbackPage() {
  const user = await requireRole(ROLES.DEPT_LEADER);

  const feedback = await prisma.mentorFeedback.findMany({
    where: {
      mentor: {
        mentorAssignments: {
          some: { cohort: { programId: user.programId ?? "" } },
        },
      },
    },
    include: {
      mentor: true,
      student: { include: { user: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-navy">Mentor feedback</h1>
        <p className="mt-1.5 text-base text-gray-500">
          Ratings for mentors assigned in your program.
        </p>
      </div>
      <MentorFeedbackList feedback={feedback} />
    </div>
  );
}
