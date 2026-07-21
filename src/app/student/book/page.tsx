import { redirect } from "next/navigation";

import { Deadline } from "@/components/deadline";
import { ArrowUpRightIcon } from "@/components/icons";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { formatHours } from "@/lib/format";
import { allocationSummary } from "@/lib/hours";
import { prisma } from "@/lib/prisma";
import { assignmentsForStudentWhere } from "@/lib/queries";

/**
 * Booking is entirely external Calendly links (spec §8) — this page lists
 * the mentors assigned to the student's program (or cohort) with each
 * mentor's link and the hours the student still holds with them.
 */
export default async function StudentBookPage() {
  const user = await requireRole(ROLES.STUDENT);

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { program: true, cohort: true },
  });

  // Not onboarded / not approved yet — the home page explains what's next.
  if (!profile || user.status !== USER_STATUS.ACTIVE) redirect("/student");

  const [assignments, hours] = await Promise.all([
    prisma.mentorAssignment.findMany({
      where: assignmentsForStudentWhere(profile),
      include: { mentor: true },
      orderBy: { createdAt: "asc" },
    }),
    allocationSummary(profile.id),
  ]);
  const hoursByMentor = new Map(hours.perMentor.map((m) => [m.mentor.id, m]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Book a session</h1>
        <p className="mt-1.5 text-base text-muted-fg">
          Mentors for {profile.program.name}
          {profile.cohort ? ` / ${profile.cohort.name}` : ""}. Booking happens
          on the mentor&apos;s calendar; the session appears in your history
          and draws down your hours with that mentor after the mentor logs it.
        </p>
      </div>

      {assignments.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-[15px] text-muted-fg">
          No mentors are assigned to your program yet. Check back soon.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {assignments.map((a) => {
            const withMentor = hoursByMentor.get(a.mentorId);
            const remaining = withMentor?.remaining;
            return (
              <li
                key={a.id}
                className="flex flex-col justify-between rounded-xl border border-line bg-surface p-5 transition hover:border-accent/50 hover:shadow-sm"
              >
                <div>
                  <h2 className="text-lg font-semibold text-ink">
                    {a.mentor.name ?? a.mentor.email}
                  </h2>
                  {a.mentor.name && (
                    <p className="mt-0.5 text-xs text-muted-fg">
                      {a.mentor.email}
                    </p>
                  )}
                  <p className="mt-2 text-xs">
                    {remaining === undefined ? (
                      <span className="text-muted-fg">
                        No hours allocated with this mentor
                      </span>
                    ) : (
                      <span
                        className={
                          remaining < 0
                            ? "font-medium text-red-700"
                            : "font-medium text-accent-ink"
                        }
                      >
                        {formatHours(remaining)} hours remaining with them
                      </span>
                    )}
                  </p>
                  {withMentor?.deadline && (
                    <p className="mt-1 text-xs text-muted-fg">
                      Use them by <Deadline deadline={withMentor.deadline} />
                    </p>
                  )}
                </div>
                {a.calendlyUrl ? (
                  <a
                    href={a.calendlyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group mt-5 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-center text-[15px] font-semibold text-white transition-colors hover:bg-accent-dark"
                  >
                    Book with {a.mentor.name?.split(" ")[0] ?? "this mentor"}
                    <ArrowUpRightIcon className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                ) : (
                  <p className="mt-5 flex min-h-11 items-center justify-center rounded-lg border border-dashed border-line px-4 py-2.5 text-center text-sm text-muted-fg">
                    No booking link yet — reach them on Telegram or check back
                    soon.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
