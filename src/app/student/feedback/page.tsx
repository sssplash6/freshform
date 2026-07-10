import {
  MentorFeedbackForm,
  WebsiteFeedbackForm,
} from "@/components/forms/feedback-forms";
import { Rating } from "@/components/rating";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export default async function StudentFeedbackPage() {
  const user = await requireRole(ROLES.STUDENT);

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
  });
  if (!profile) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your account isn&apos;t linked to a cohort. Ask your program contact to
        fix your registration.
      </p>
    );
  }

  // Mentors the student can rate: assigned to their cohort, plus anyone
  // they've had a session with (covers mentors reassigned since).
  const [assignments, pastMentors, myMentorFeedback, myWebsiteFeedback] =
    await Promise.all([
      prisma.mentorAssignment.findMany({
        where: { cohortId: profile.cohortId },
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
      <h1 className="text-3xl font-bold tracking-tight text-navy">Feedback</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        {mentors.length > 0 ? (
          <MentorFeedbackForm mentors={mentors} />
        ) : (
          <p className="rounded-lg border border-mist bg-white p-8 text-[15px] text-gray-500">
            You&apos;ll be able to rate mentors once one is assigned to your
            cohort.
          </p>
        )}
        <WebsiteFeedbackForm />
      </div>

      {(myMentorFeedback.length > 0 || myWebsiteFeedback.length > 0) && (
        <section>
          <h2 className="mb-2 text-base font-semibold text-navy">
            Your previous feedback
          </h2>
          <ul className="space-y-2">
            {myMentorFeedback.map((f) => (
              <li
                key={f.id}
                className="rounded-lg border border-mist bg-white p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {f.mentor.name ?? f.mentor.email}
                  </span>
                  <Rating value={f.rating} />
                </div>
                {f.comment && (
                  <p className="mt-1 text-gray-600">{f.comment}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {f.createdAt.toISOString().slice(0, 10)}
                </p>
              </li>
            ))}
            {myWebsiteFeedback.map((f) => (
              <li
                key={f.id}
                className="rounded-lg border border-mist bg-white p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    Website feedback
                  </span>
                  <Rating value={f.rating} />
                </div>
                {f.comment && (
                  <p className="mt-1 text-gray-600">{f.comment}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {f.createdAt.toISOString().slice(0, 10)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
