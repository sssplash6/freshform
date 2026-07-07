import { redirect } from "next/navigation";

import { ROLES, USER_STATUS } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { formatHours } from "@/lib/format";
import { allocationSummary } from "@/lib/hours";
import { prisma } from "@/lib/prisma";

/**
 * Booking is entirely external Calendly links (spec §8) — this page lists
 * the mentors assigned to the student's cohort with each mentor's link and
 * the hours the student still holds with them.
 */
export default async function StudentBookPage() {
  const user = await requireRole(ROLES.STUDENT);

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { cohort: { include: { program: true } } },
  });

  // Not onboarded / not approved yet — the home page explains what's next.
  if (!profile || user.status !== USER_STATUS.ACTIVE) redirect("/student");

  const [assignments, hours] = await Promise.all([
    prisma.mentorAssignment.findMany({
      where: { cohortId: profile.cohortId },
      include: { mentor: true },
      orderBy: { createdAt: "asc" },
    }),
    allocationSummary(profile.id),
  ]);
  const remainingByMentor = new Map(
    hours.perMentor.map((m) => [m.mentor.id, m.remaining])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">Book a session</h1>
        <p className="mt-1 text-sm text-gray-500">
          Mentors for {profile.cohort.program.name} / {profile.cohort.name}.
          Booking happens on the mentor&apos;s calendar; the session appears in
          your history — and draws down your hours with that mentor — after
          the mentor logs it.
        </p>
      </div>

      {assignments.length === 0 ? (
        <p className="rounded-lg border border-mist bg-white p-6 text-sm text-gray-500">
          No mentors are assigned to your cohort yet — check back soon.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {assignments.map((a) => {
            const remaining = remainingByMentor.get(a.mentorId);
            return (
              <li
                key={a.id}
                className="flex flex-col justify-between rounded-lg border border-mist bg-white p-4"
              >
                <div>
                  <h2 className="font-medium text-gray-900">
                    {a.mentor.name ?? a.mentor.email}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {a.mentor.email}
                  </p>
                  <p className="mt-2 text-xs">
                    {remaining === undefined ? (
                      <span className="text-gray-400">
                        No hours allocated with this mentor
                      </span>
                    ) : (
                      <span
                        className={
                          remaining < 0
                            ? "font-medium text-red-600"
                            : "font-medium text-brand-deep"
                        }
                      >
                        {formatHours(remaining)} hours remaining with them
                      </span>
                    )}
                  </p>
                </div>
                <a
                  href={a.calendlyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-brand-deep"
                >
                  Book with {a.mentor.name?.split(" ")[0] ?? "this mentor"} ↗
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
