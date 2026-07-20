import { redirect } from "next/navigation";

import { ArrowLink } from "@/components/arrow-link";
import { Chip } from "@/components/chip";
import { MentorHoursList } from "@/components/mentor-hours-list";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Tr } from "@/components/ui/table";
import { ROLES, SESSION_STATUS, USER_STATUS } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { formatDate, formatHours } from "@/lib/format";
import { ensureDeadlineReminders } from "@/lib/deadline-reminders";
import { allocationSummary } from "@/lib/hours";
import { prisma } from "@/lib/prisma";

export default async function StudentHomePage() {
  const user = await requireRole(ROLES.STUDENT);
  await ensureDeadlineReminders();

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: {
      program: true,
      cohort: true,
      sessions: {
        include: { mentor: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      },
    },
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

  const hours = await allocationSummary(profile.id);
  const activeSessions = profile.sessions.filter(
    (s) => s.status === SESSION_STATUS.ACTIVE
  );

  return (
    <div className="space-y-8">
      <PageHeader title="My hours" subtitle={enrollmentLabel} />

      <StatCardGrid>
        <StatCard label="Hours allotted" value={formatHours(hours.allotted)} />
        <StatCard
          label="Hours completed"
          value={formatHours(hours.completed)}
          tone="brand"
        />
        <StatCard
          label="Hours remaining"
          value={formatHours(hours.remaining)}
          tone={hours.remaining < 0 ? "danger" : "default"}
        />
        <StatCard label="Sessions" value={String(activeSessions.length)} />
      </StatCardGrid>

      {hours.remaining < 0 && (
        <Callout tone="danger">
          You&apos;ve used {formatHours(-hours.remaining)} hours more than your
          allotment. Talk to your program contact about topping up.
        </Callout>
      )}

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">
          Hours with each mentor
        </h2>
        <MentorHoursList items={hours.perMentor} />
      </section>

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

      {hours.completed > 0 && (
        <Callout
          row
          title="How was your last session?"
          action={<ArrowLink href="/student/feedback">Rate your mentor</ArrowLink>}
        />
      )}

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">
          Session history
        </h2>
        {profile.sessions.length === 0 ? (
          <EmptyState title="No sessions yet">
            Book your first session with a mentor to get started.
          </EmptyState>
        ) : (
          <Table
            columns={[
              { label: "Date" },
              { label: "Mentor" },
              { label: "Hours", align: "right" },
              { label: "Task" },
              { label: "Note" },
              { label: "Status" },
            ]}
          >
            {profile.sessions.map((s) => {
              const voided = s.status === SESSION_STATUS.VOIDED;
              return (
                <Tr key={s.id} className={voided ? "opacity-50" : ""}>
                  <Td className="tabular-nums">{formatDate(s.date)}</Td>
                  <Td>{s.mentor.name ?? s.mentor.email}</Td>
                  <Td align="right" className="tabular-nums">
                    {formatHours(s.hours)}
                  </Td>
                  <Td className="max-w-56 truncate text-muted-fg">
                    {s.task ?? "—"}
                  </Td>
                  <Td className="max-w-56 truncate text-muted-fg">
                    {s.note ?? "—"}
                  </Td>
                  <Td>
                    {voided ? (
                      <Chip tone="gray">Voided, hours returned</Chip>
                    ) : (
                      <Chip tone="green">Completed</Chip>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </Table>
        )}
      </section>
    </div>
  );
}
