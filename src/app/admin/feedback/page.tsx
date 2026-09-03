import { MentorFeedbackList } from "@/components/mentor-feedback-list";
import { Rating } from "@/components/rating";
import { Figure, FigureRow } from "@/components/ui/figure";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { mentorFeedbackGroups } from "@/lib/feedback";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableText } from "@/components/expandable-text";

/** Mentors per page of the grouped list, and site comments per page. */
const MENTORS_PER_PAGE = 10;
const SITE_PER_PAGE = 20;

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; site?: string }>;
}) {
  await requireRole(ROLES.ADMIN);
  const { page: rawPage, site: rawSite } = await searchParams;
  const page = parsePage(rawPage);
  const sitePage = parsePage(rawSite);

  // The headline numbers are aggregates, not a whole table read into memory to
  // be averaged in JavaScript.
  const [mentorStats, siteStats, { groups, mentors }, websiteFeedback] =
    await Promise.all([
      prisma.mentorFeedback.aggregate({ _avg: { rating: true }, _count: true }),
      prisma.websiteFeedback.aggregate({ _avg: { rating: true }, _count: true }),
      mentorFeedbackGroups(
        {},
        { skip: (page - 1) * MENTORS_PER_PAGE, take: MENTORS_PER_PAGE }
      ),
      prisma.websiteFeedback.findMany({
        include: { student: { include: { user: true } } },
        orderBy: { createdAt: "desc" },
        skip: (sitePage - 1) * SITE_PER_PAGE,
        take: SITE_PER_PAGE,
      }),
    ]);

  const mentorAvg = mentorStats._avg.rating;
  const siteAvg = siteStats._avg.rating;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-ink">Feedback</h1>

      <FigureRow>
        <Figure label="Mentor ratings" value={String(mentorStats._count)} />
        <Figure
          label="Avg mentor rating"
          value={mentorAvg === null ? "—" : mentorAvg.toFixed(1)}
        />
        <Figure label="Website ratings" value={String(siteStats._count)} />
        <Figure
          label="Avg website rating"
          value={siteAvg === null ? "—" : siteAvg.toFixed(1)}
        />
      </FigureRow>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Mentor feedback</h2>
        <MentorFeedbackList groups={groups} mentorBase="/admin/mentors" />
        <Pagination
          basePath="/admin/feedback"
          params={{ site: rawSite }}
          page={page}
          pageSize={MENTORS_PER_PAGE}
          total={mentors}
          unit="rated mentors"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Website feedback</h2>
        {websiteFeedback.length === 0 ? (
          <EmptyState title="No website feedback">
            Students leave this from their own feedback page; most never do.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {websiteFeedback.map((f) => (
              <li
                key={f.id}
                className="rounded-xl border border-line bg-surface p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Rating value={f.rating} />
                  <span className="text-xs text-muted-fg">
                    by {f.student.user.name ?? f.student.user.email} ·{" "}
                    {f.createdAt.toISOString().slice(0, 10)}
                  </span>
                </div>
                {f.comment && (
                  <div className="mt-0.5">
                    <ExpandableText text={f.comment} className="text-muted-fg" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <Pagination
          basePath="/admin/feedback"
          params={{ page: rawPage }}
          page={sitePage}
          pageSize={SITE_PER_PAGE}
          total={siteStats._count}
          unit="website ratings"
          param="site"
        />
      </section>
    </div>
  );
}
