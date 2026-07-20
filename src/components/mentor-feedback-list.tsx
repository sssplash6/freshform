import { Rating, average } from "@/components/rating";
import type { MentorFeedback, StudentProfile, User } from "@/generated/prisma/client";

type FeedbackRow = MentorFeedback & {
  mentor: User;
  student: StudentProfile & { user: User };
};

/**
 * Mentor feedback grouped per mentor with averages. Staff views include the
 * student's identity (only the mentor-facing view is anonymous).
 */
export function MentorFeedbackList({ feedback }: { feedback: FeedbackRow[] }) {
  if (feedback.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface p-8 text-[15px] text-muted-fg">
        No mentor feedback yet.
      </p>
    );
  }

  const byMentor = new Map<string, FeedbackRow[]>();
  for (const f of feedback) {
    if (!byMentor.has(f.mentorId)) byMentor.set(f.mentorId, []);
    byMentor.get(f.mentorId)!.push(f);
  }

  return (
    <div className="space-y-4">
      {[...byMentor.values()].map((rows) => {
        const mentor = rows[0].mentor;
        const avg = average(rows.map((r) => r.rating))!;
        return (
          <section
            key={mentor.id}
            className="rounded-xl border border-line bg-surface p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-ink">
                  {mentor.name ?? mentor.email}
                </h3>
                <p className="text-xs text-muted-fg">{mentor.email}</p>
              </div>
              <div className="text-right text-sm">
                <Rating value={Math.round(avg)} />
                <p className="text-xs text-muted-fg">
                  {avg.toFixed(1)} avg · {rows.length} rating
                  {rows.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <ul className="mt-3 space-y-2 border-t border-line/60 pt-3">
              {rows.map((f) => (
                <li key={f.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <Rating value={f.rating} />
                    <span className="text-xs text-muted-fg">
                      by {f.student.user.name ?? f.student.user.email} ·{" "}
                      {f.createdAt.toISOString().slice(0, 10)}
                    </span>
                  </div>
                  {f.comment && (
                    <p className="mt-0.5 text-muted-fg">{f.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
