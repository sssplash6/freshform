import { Rating } from "@/components/rating";
import { Figure, FigureRow } from "@/components/ui/figure";
import { PAGE_SIZE, Pagination, parsePage } from "@/components/ui/pagination";
import { requireMentor } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableText } from "@/components/expandable-text";

/**
 * A mentor's own ratings. Anonymous by policy: no student names or
 * identifying details are shown here.
 */
export default async function MentorFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireMentor();
  const page = parsePage((await searchParams).page);

  // The count and the average describe every rating; the list is one page of
  // them. Averaging a whole table in JavaScript is what the aggregate is for.
  const [feedback, stats] = await Promise.all([
    prisma.mentorFeedback.findMany({
      where: { mentorId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.mentorFeedback.aggregate({
      where: { mentorId: user.id },
      _avg: { rating: true },
      _count: true,
    }),
  ]);
  const avg = stats._avg.rating;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">My feedback</h1>
        <p className="mt-1.5 text-base text-muted-fg">
          Feedback is anonymous: student names are never shown.
        </p>
      </div>

      <FigureRow>
        <Figure label="Ratings received" value={String(stats._count)} />
        <Figure
          label="Average rating"
          value={avg === null ? "—" : avg.toFixed(1)}
        />
      </FigureRow>

      {stats._count === 0 ? (
        <EmptyState title="No ratings yet">
          Students rate a mentor when they choose to; many never do.
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-2">
            {feedback.map((f) => (
              <li
                key={f.id}
                className="rounded-xl border border-line bg-surface p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <Rating value={f.rating} />
                  <span className="text-xs text-muted-fg">
                    {f.createdAt.toISOString().slice(0, 10)}
                  </span>
                </div>
                {f.comment && (
                  <div className="mt-1">
                    <ExpandableText text={f.comment} className="text-muted-fg" />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination
            basePath="/mentor/feedback"
            params={{}}
            page={page}
            total={stats._count}
            unit="ratings"
            className="mt-3"
          />
        </>
      )}
    </div>
  );
}
