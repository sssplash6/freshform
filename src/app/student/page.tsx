import { redirect } from "next/navigation";

import { ArrowLink } from "@/components/arrow-link";
import { AssignmentsPanel } from "@/components/assignments-panel";
import { MeetingsLog } from "@/components/meetings-log";
import { MentorHoursList } from "@/components/mentor-hours-list";
import { StatCard, StatCardGrid } from "@/components/stat-card";
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
        <PageHeader title="Registration received" subtitle={enrollmentLabel} />
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={enrollmentLabel}
        title={`Hi, ${user.name?.split(" ")[0] ?? "there"}`}
        subtitle={`${formatHours(hours.remaining)} of your ${formatHours(hours.allotted)} mentoring hours are still yours to use.`}
        monogram={initials(user.name, user.email)}
        tone="warm"
      />

      <StatCardGrid>
        <StatCard label="Hours allotted" value={formatHours(hours.allotted)} />
        <StatCard
          label="Hours completed"
          value={formatHours(hours.completed)}
          tone="brand"
        />
        {hours.missed > 0 && (
          <StatCard label="Hours missed" value={formatHours(hours.missed)} />
        )}
        {hours.forfeited > 0 && (
          <StatCard
            label="Hours expired"
            value={formatHours(hours.forfeited)}
            tone="danger"
          />
        )}
        <StatCard
          label="Hours remaining"
          value={formatHours(hours.remaining)}
          suffix="h"
          tone={hours.remaining < 0 ? "danger" : "default"}
          lead
        />
        <StatCard
          label="Sessions"
          value={String(activeSessions.length)}
          tone="muted"
        />
      </StatCardGrid>

      {hours.remaining < 0 && (
        <Callout tone="danger">
          You&apos;ve used {formatHours(-hours.remaining)} hours more than your
          allotment. Talk to your program contact about topping up.
        </Callout>
      )}

      {hours.forfeited > 0 && (
        <Callout tone="danger">
          {formatHours(hours.forfeited)} of your hours expired unused past their
          deadline and can no longer be used. Talk to your program contact if
          you need them reinstated.
        </Callout>
      )}

      <MeetingsLog sessions={ledger.sessions} />

      <AssignmentsPanel
        assignments={ledger.assignments}
        studentProfileId={profile.id}
        hoursAllotted={hours.allotted}
      />

      <MentorHoursList items={hours.perMentor} />

      <Callout
        tone="brand"
        row
        title="Ready for your next session?"
        action={
          <ArrowLink href="/student/book">
            Book with one of your mentors
          </ArrowLink>
        }
      />
    </div>
  );
}
