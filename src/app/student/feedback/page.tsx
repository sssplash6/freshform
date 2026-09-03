import {
  MentorFeedbackForm,
  WebsiteFeedbackForm,
} from "@/components/forms/feedback-forms";
import { Rating } from "@/components/rating";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assignmentsForStudentWhere } from "@/lib/queries";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableText } from "@/components/expandable-text";
import { formatDate } from "@/lib/format";

export default async function StudentFeedbackPage() {
  const user = await requireRole(ROLES.STUDENT);

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
  });
  if (!profile) {
    return (
      <p className="rounded-lg border border-danger-line bg-danger-soft p-6 text-sm text-danger-ink">
        Your account isn&apos;t linked to a program yet, so there is nobody
            to rate.
      </p>
    );
  }

  // Mentors the student can rate: assigned to their program (or cohort),
  // plus anyone they've had a session with (covers mentors reassigned since).
  const [assignments, pastMentors, myMentorFeedback, myWebsiteFeedback] =
    await Promise.all([
      prisma.mentorAssignment.findMany({
        where: assignmentsForStudentWhere(profile),
        include: { mentor: true },
      }),
      prisma.session.findMany({
        where: { studentId: profile.id },
        include: { mentor: true },
        distinct: ["mentorId"],
      }),
      prisma.mentorFeedback.findMany({
        where: { studentId: profile.id },
        include: { mentor: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.websiteFeedback.findMany({
        where: { studentId: profile.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const mentorById = new Map(
    [
      ...assignments.map((a) => a.mentor),
      ...pastMentors.map((s) => s.mentor),
    ].map((m) => [m.id, m])
  );
  const mentors = [...mentorById.values()].map((m) => ({
    id: m.id,
    label: m.name ?? m.email,
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-ink">Feedback</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        {mentors.length > 0 ? (
          <MentorFeedbackForm mentors={mentors} />
        ) : (
          <EmptyState variant="blocked" title="No mentor to rate yet">
            Your program assigns one before you can leave feedback.
          </EmptyState>
        )}
        <WebsiteFeedbackForm />
      </div>

      {(myMentorFeedback.length > 0 || myWebsiteFeedback.length > 0) && (
        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">
            Your previous feedback
          </h2>
          <ul className="space-y-2">
            {myMentorFeedback.map((f) => (
              <li
                key={f.id}
                className="rounded-xl border border-line bg-surface p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">
                    {f.mentor.name ?? f.mentor.email}
                  </span>
                  <Rating value={f.rating} />
                </div>
                {f.comment && (
                  <div className="mt-1 text-muted-fg">
                    <ExpandableText text={f.comment} className="text-muted-fg" />
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-fg">
                  {formatDate(f.createdAt)}
                </p>
              </li>
            ))}
            {myWebsiteFeedback.map((f) => (
              <li
                key={f.id}
                className="rounded-xl border border-line bg-surface p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">
                    Website feedback
                  </span>
                  <Rating value={f.rating} />
                </div>
                {f.comment && (
                  <p className="mt-1 text-muted-fg">{f.comment}</p>
                )}
                <p className="mt-1 text-xs text-muted-fg">
                  {formatDate(f.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
