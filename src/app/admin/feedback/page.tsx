import { MentorFeedbackList } from "@/components/mentor-feedback-list";
import { Rating, average } from "@/components/rating";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { prisma } from "@/lib/prisma";

export default async function AdminFeedbackPage() {
  const [mentorFeedback, websiteFeedback] = await Promise.all([
    prisma.mentorFeedback.findMany({
      include: {
        mentor: true,
        student: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.websiteFeedback.findMany({
      include: { student: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const mentorAvg = average(mentorFeedback.map((f) => f.rating));
  const siteAvg = average(websiteFeedback.map((f) => f.rating));

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-navy">Feedback</h1>

      <StatCardGrid>
        <StatCard
          label="Mentor ratings"
          value={String(mentorFeedback.length)}
        />
        <StatCard
          label="Avg mentor rating"
          value={mentorAvg === null ? "—" : mentorAvg.toFixed(1)}
          tone="brand"
        />
        <StatCard
          label="Website ratings"
          value={String(websiteFeedback.length)}
        />
        <StatCard
          label="Avg website rating"
          value={siteAvg === null ? "—" : siteAvg.toFixed(1)}
          tone="brand"
        />
      </StatCardGrid>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-navy">
          Mentor feedback
        </h2>
        <MentorFeedbackList feedback={mentorFeedback} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-navy">
          Website feedback
        </h2>
        {websiteFeedback.length === 0 ? (
          <p className="rounded-lg border border-mist bg-white p-6 text-sm text-gray-500">
            No website feedback yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {websiteFeedback.map((f) => (
              <li
                key={f.id}
                className="rounded-lg border border-mist bg-white p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Rating value={f.rating} />
                  <span className="text-xs text-gray-500">
                    by {f.student.user.name ?? f.student.user.email} ·{" "}
                    {f.createdAt.toISOString().slice(0, 10)}
                  </span>
                </div>
                {f.comment && (
                  <p className="mt-0.5 text-gray-600">{f.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
