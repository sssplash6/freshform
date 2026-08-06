import Link from "next/link";
import { redirect } from "next/navigation";

import { HoursRing } from "@/components/hours-ring";
import { ArrowRightIcon } from "@/components/icons";
import { MentorHoursList } from "@/components/mentor-hours-list";
import { StudentGoals } from "@/components/student-goals";
import { StudentJourney } from "@/components/student-journey";
import { Callout } from "@/components/ui/callout";
import { PageHeader } from "@/components/ui/page-header";
import { ROLES, SESSION_STATUS, USER_STATUS } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { formatHours } from "@/lib/format";
import { ensureDeadlineReminders } from "@/lib/deadline-reminders";
import { allocationSummary } from "@/lib/hours";
import { initials } from "@/lib/person-tone";
import { prisma } from "@/lib/prisma";
import { studentLedger } from "@/lib/queries";

/** A small figure the student can act on, beside the ring rather than in a strip. */
function Fact({
  value,
  label,
  tone = "ink",
}: {
  value: string;
  label: string;
  tone?: "ink" | "accent" | "danger" | "muted";
}) {
  const color =
    tone === "accent"
      ? "text-accent-ink"
      : tone === "danger"
        ? "text-red-700"
        : tone === "muted"
          ? "text-muted-fg"
          : "text-ink";
  return (
    <div>
      <div className={`text-xl font-bold leading-none tabular-nums ${color}`}>
        {value}
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-fg">
        {label}
      </div>
    </div>
  );
}

export default async function StudentHomePage() {
  const user = await requireRole(ROLES.STUDENT);
  await ensureDeadlineReminders();

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { program: true, cohort: true },
  });

  // Self-signed-up student who hasn't registered yet, or a staff-registered
  // student who hasn't confirmed their name / Telegram username.
  if (!profile || !user.name?.trim() || !profile.telegramUsername) {
    redirect("/student/onboarding");
  }

  const enrollmentLabel = profile.cohort
    ? `${profile.program.name} / ${profile.cohort.name}`
    : profile.program.name;

  // Registered but not yet approved by an admin.
  if (user.status === USER_STATUS.PENDING) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow={enrollmentLabel}
          title="Registration received"
          subtitle="You're on the list. There's one step left before your hours appear."
          tone="warm"
          monogram={initials(user.name, user.email)}
        />
        <Callout tone="brand">
          An admin is reviewing your registration. Once approved, your mentoring
          hours will be allocated and appear here.
        </Callout>
      </div>
    );
  }

  const [hours, ledger] = await Promise.all([
    allocationSummary(profile.id),
    studentLedger(profile.id),
  ]);
  const activeSessions = ledger.sessions.filter(
    (s) => s.status === SESSION_STATUS.ACTIVE
  );
  const firstName = user.name?.split(" ")[0] ?? "there";
  const tasksLeft = ledger.assignments.filter((a) => a.progress !== "DONE").length;

  return (
    <div className="space-y-6">
      {/* The one question a student opens this app to answer, given a shape.
          Everything below is detail behind it. */}
      <section className="lift-in relative overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="h-[3px] w-full bg-accent" aria-hidden="true" />
        <div className="relative bg-gradient-to-br from-accent-soft to-surface px-5 py-6 sm:px-7">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-8 right-4 select-none text-[120px] font-black leading-none tracking-tighter text-ink/[0.045]"
          >
            {initials(user.name, user.email)}
          </span>
          <div className="relative flex flex-wrap items-center justify-between gap-x-8 gap-y-6">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.11em] text-accent-ink">
                {enrollmentLabel}
              </div>
              <h1 className="mt-1.5 text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">
                Hi, {firstName}
              </h1>
              <p className="mt-2 max-w-md text-[15px] text-muted-fg">
                {hours.remaining > 0
                  ? `You have ${formatHours(hours.remaining)} mentoring hours left to use${tasksLeft > 0 ? `, and ${tasksLeft} ${tasksLeft === 1 ? "task" : "tasks"} still in the works` : ""}.`
                  : "Your mentoring hours are all used up. Talk to your program contact about topping up."}
              </p>

              <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
                <Fact
                  value={formatHours(hours.completed)}
                  label="Hours completed"
                  tone="accent"
                />
                <Fact
                  value={String(activeSessions.length)}
                  label="Sessions"
                  tone="muted"
                />
                <Fact
                  value={String(hours.perMentor.length)}
                  label="Mentors"
                  tone="muted"
                />
                {hours.missed > 0 && (
                  <Fact
                    value={formatHours(hours.missed)}
                    label="Hours missed"
                    tone="danger"
                  />
                )}
              </div>

              <Link
                href="/student/book"
                className="group mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 text-[15px] font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Book your next session
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <HoursRing
              used={hours.completed + hours.missed}
              allotted={hours.allotted}
              className="mx-auto sm:mx-0"
            />
          </div>
        </div>
      </section>

      {hours.remaining < 0 && (
        <Callout tone="danger" title="You're over your allotment">
          You&apos;ve used {formatHours(-hours.remaining)} hours more than you
          were given. Talk to your program contact about topping up.
        </Callout>
      )}

      {hours.forfeited > 0 && (
        <Callout tone="danger" title="Some hours expired">
          {formatHours(hours.forfeited)} of your hours passed their deadline
          unused and can no longer be used. Talk to your program contact if you
          need them reinstated.
        </Callout>
      )}

      <StudentGoals assignments={ledger.assignments} />

      <StudentJourney sessions={ledger.sessions} />

      <MentorHoursList items={hours.perMentor} />
    </div>
  );
}
