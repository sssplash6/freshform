import Link from "next/link";

import { Rating } from "@/components/rating";
import type { MentorFeedback, StudentProfile, User } from "@/generated/prisma/client";

type FeedbackRow = MentorFeedback & {
  student: StudentProfile & { user: User };
};

/**
 * One mentor's standing: their average and total over every rating they have
 * ever had, and the most recent handful of comments.
 *
 * The average and the count come from the database rather than from `rows`,
 * because `rows` is deliberately only the latest few. A page that read every
 * rating ever written just to average five of them is the thing this replaces.
 */
export type MentorFeedbackGroup = {
  mentor: User;
  average: number;
  total: number;
  rows: FeedbackRow[];
};

/**
 * Mentor feedback grouped per mentor with averages. Staff views include the
 * student's identity (only the mentor-facing view is anonymous). `mentorBase`
 * links each heading through to the mentor's page — admin only, since leaders
 * have no such page.
 */
export function MentorFeedbackList({
  groups,
  mentorBase,
}: {
  groups: MentorFeedbackGroup[];
  mentorBase?: string;
}) {
  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface p-8 text-[15px] text-muted-fg">
        No mentor feedback yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(({ mentor, average, total, rows }) => (
        <section
          key={mentor.id}
          className="rounded-xl border border-line bg-surface p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-medium text-ink">
                {mentorBase ? (
                  <Link
                    href={`${mentorBase}/${mentor.id}`}
                    className="hover:text-brand"
                  >
                    {mentor.name ?? mentor.email}
                  </Link>
                ) : (
                  (mentor.name ?? mentor.email)
                )}
              </h3>
              <p className="truncate text-xs text-muted-fg">{mentor.email}</p>
            </div>
            <div className="shrink-0 text-right text-sm">
              <Rating value={Math.round(average)} />
              <p className="text-xs text-muted-fg">
                {average.toFixed(1)} avg · {total} rating
                {total === 1 ? "" : "s"}
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
          {total > rows.length && (
            <p className="mt-2 text-xs text-muted-fg">
              Showing the {rows.length} most recent of {total}.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
