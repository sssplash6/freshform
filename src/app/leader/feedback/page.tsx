import { MentorFeedbackList } from "@/components/mentor-feedback-list";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { mentorFeedbackGroups } from "@/lib/feedback";

const MENTORS_PER_PAGE = 10;

/** Dept Leader: feedback for mentors assigned within their program only. */
export default async function LeaderFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireRole(ROLES.DEPT_LEADER);
  const page = parsePage((await searchParams).page);

  const { groups, mentors } = await mentorFeedbackGroups(
    {
      mentor: {
        mentorAssignments: {
          some: { programId: user.programId ?? "" },
        },
      },
    },
    { skip: (page - 1) * MENTORS_PER_PAGE, take: MENTORS_PER_PAGE }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Mentor feedback</h1>
        <p className="mt-1.5 text-base text-muted-fg">
          Ratings for mentors assigned in your program.
        </p>
      </div>
      <MentorFeedbackList groups={groups} />
      <Pagination
        basePath="/leader/feedback"
        params={{}}
        page={page}
        pageSize={MENTORS_PER_PAGE}
        total={mentors}
        unit="rated mentors"
      />
    </div>
  );
}
