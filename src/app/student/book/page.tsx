import { redirect } from "next/navigation";

import { ArrowUpRightIcon } from "@/components/icons";
import { PersonChip } from "@/components/person-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import { PageTitle } from "@/components/ui/section";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { formatDuration } from "@/lib/format";
import { allocationSummary } from "@/lib/hours";
import { personTone } from "@/lib/person-tone";
import { prisma } from "@/lib/prisma";
import { assignmentsForStudentWhere } from "@/lib/queries";
import { cn } from "@/lib/cn";
import { DeadlineText } from "@/components/ui/status-chip";

/**
 * Booking is entirely external Calendly links (spec §8) — this page lists the
 * mentors assigned to the student's program (or cohort), each as a card in that
 * mentor's own identity color, with the hours the student still holds with them.
 *
 * Ordered by hours remaining: the mentor a student can book the most time with
 * belongs at the top, rather than whoever happened to be assigned first.
 */
export default async function StudentBookPage() {
  const user = await requireRole(ROLES.STUDENT);
  const now = new Date();

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
  // Pooled hours (no mentor yet) aren't bookable, so they don't map to a card.
  const hoursByMentor = new Map(
    hours.perMentor.flatMap((m) => (m.mentor ? [[m.mentor.id, m] as const] : []))
  );

  const cards = [...assignments].sort(
    (a, b) =>
      (hoursByMentor.get(b.mentorId)?.remaining ?? -1) -
      (hoursByMentor.get(a.mentorId)?.remaining ?? -1)
  );
  const bookable = cards.filter((a) => a.calendlyUrl).length;

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow={
          profile.cohort
            ? `${profile.program.name} / ${profile.cohort.name}`
            : profile.program.name
        }
        title="Book a session"
        subtitle={
          bookable > 0
            ? "Pick a mentor and choose a time on their calendar. The session shows up in your history once they log it."
            : "Your mentors haven't shared their calendars yet. Reach them on Telegram in the meantime."
        }
      />

      {cards.length === 0 ? (
        <EmptyState title="No mentors yet">
          Nobody is assigned to your program yet. Your program arranges it.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {cards.map((a, i) => {
            const withMentor = hoursByMentor.get(a.mentorId);
            const remaining = withMentor?.remaining;
            const allocated = withMentor?.allocated ?? 0;
            const used = allocated - (remaining ?? 0);
            const tone = personTone(a.mentorId);
            return (
              <li
                key={a.id}
                className="deal-in flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-soft"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              >
                {/* The mentor's own color across the top, matching their chip
                    everywhere else in the app. */}
                <div
                  className={cn("h-[3px] w-full", tone.badge)}
                  aria-hidden="true"
                />
                <div className="flex flex-1 flex-col p-5">
                  <PersonChip
                    person={a.mentor}
                    href={`/mentors/${a.mentorId}`}
                    className="self-start"
                  />

                  {remaining === undefined ? (
                    <p className="mt-4 text-sm text-muted-fg">
                      No time with this mentor yet.
                    </p>
                  ) : (
                    <>
                      <p className="mt-4">
                        <span
                          className={cn(
                            "text-2xl font-bold leading-none tabular-nums",
                            remaining < 0 ? "text-danger-ink" : "text-ink",
                          )}
                        >
                          {formatDuration(remaining < 0 ? -remaining : remaining)}
                        </span>
                        <span className="ml-1.5 text-sm text-muted-fg">
                          {remaining < 0 ? "over" : "you can book"}
                        </span>
                      </p>
                      {allocated > 0 && (
                        <Meter
                          className="mt-2.5"
                          size="sm"
                          pct={Math.min(100, Math.round((used / allocated) * 100))}
                          tone={remaining < 0 ? "danger" : "accent"}
                          ariaValueNow={used}
                          ariaValueMax={allocated}
                          ariaLabel={`Time used with ${a.mentor.name ?? a.mentor.email}`}
                        />
                      )}
                      {withMentor?.deadline && (
                        <p className="mt-2 text-xs text-muted-fg">
                          Use them by <DeadlineText deadline={withMentor.deadline} now={now} />
                        </p>
                      )}
                    </>
                  )}

                  <div className="mt-auto pt-5">
                    {a.calendlyUrl ? (
                      <a
                        href={a.calendlyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-[15px] font-semibold text-white transition-colors hover:bg-accent-dark"
                      >
                        Book with {a.mentor.name?.split(" ")[0] ?? "them"}
                        <ArrowUpRightIcon className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </a>
                    ) : (
                      <p className="flex min-h-11 items-center justify-center rounded-lg border border-dashed border-line px-4 text-center text-sm text-muted-fg">
                        No calendar shared yet
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
