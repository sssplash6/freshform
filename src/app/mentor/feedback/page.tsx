import { Rating, average } from "@/components/rating";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { requireMentor } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * A mentor's own ratings. Anonymous by policy: no student names or
 * identifying details are shown here.
 */
export default async function MentorFeedbackPage() {
  const user = await requireMentor();

  const feedback = await prisma.mentorFeedback.findMany({
    where: { mentorId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const avg = average(feedback.map((f) => f.rating));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">My feedback</h1>
        <p className="mt-1.5 text-base text-muted-fg">
          Feedback is anonymous: student names are never shown.
        </p>
      </div>

      <StatCardGrid>
        <StatCard label="Ratings received" value={String(feedback.length)} />
        <StatCard
          label="Average rating"
          value={avg === null ? "—" : avg.toFixed(1)}
          tone="brand"
        />
      </StatCardGrid>

      {feedback.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-[15px] text-muted-fg">
          No feedback yet.
        </p>
      ) : (
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
              {f.comment && <p className="mt-1 text-muted-fg">{f.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
