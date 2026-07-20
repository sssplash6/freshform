import { notFound } from "next/navigation";

import { AllocateHoursForm } from "@/components/forms/allocate-hours-form";
import { Deadline } from "@/components/deadline";
import { Chip } from "@/components/chip";
import { ApproveStudentButtons } from "@/components/forms/approve-student-buttons";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StudentCorrections } from "@/components/forms/student-corrections";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Tr } from "@/components/ui/table";
import { USER_STATUS } from "@/lib/constants";
import { formatDate, formatHours } from "@/lib/format";
import { allocationSummary } from "@/lib/hours";
import { prisma } from "@/lib/prisma";
import {
  mentorsInProgram,
  programOptions,
  toProgramOptions,
} from "@/lib/queries";

/**
 * Admin detail page for one student: approve a pending self-signup and
 * manage the hours they hold with each mentor in their program. This is the
 * only place hour allocations are edited.
 */
export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await prisma.studentProfile.findUnique({
    where: { id },
    include: {
      user: true,
      program: true,
      cohort: true,
      allotmentChanges: {
        include: { mentor: true, changedBy: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!profile) notFound();

  const isPending = profile.user.status === USER_STATUS.PENDING;
  const [mentors, hours, programs, sessionCount] = await Promise.all([
    mentorsInProgram(profile.programId),
    allocationSummary(profile.id),
    programOptions(),
    prisma.session.count({ where: { studentId: profile.id } }),
  ]);
  const byMentor = new Map(hours.perMentor.map((m) => [m.mentor.id, m]));

  return (
    <div className="space-y-8">
      <PageHeader
        backHref={`/admin/programs/${profile.programId}`}
        backLabel={profile.program.name}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {profile.user.name ?? profile.user.email}
            {isPending && <Chip tone="amber">Pending approval</Chip>}
          </span>
        }
        subtitle={
          <>
            {profile.user.email} · {profile.program.name}
            {profile.cohort ? ` / ${profile.cohort.name}` : ""}
            {profile.telegramUsername ? (
              <>
                {" · Telegram "}
                <a
                  href={`https://t.me/${profile.telegramUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand underline decoration-line underline-offset-2 hover:decoration-brand"
                >
                  @{profile.telegramUsername}
                </a>
              </>
            ) : (
              " · Telegram not set yet"
            )}{" "}
            · registered {formatDate(profile.createdAt)}
          </>
        }
      />

      {isPending && (
        <Callout
          tone="warning"
          title="Approve this student"
          action={<ApproveStudentButtons studentProfileId={profile.id} />}
        >
          Until approved, the student can&apos;t use their hours and mentors
          can&apos;t log sessions for them.
        </Callout>
      )}

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
        <StatCard label="Mentors" value={String(hours.perMentor.length)} />
      </StatCardGrid>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">
          Hour allocations by mentor
        </h2>
        {mentors.length === 0 ? (
          <EmptyState title="No mentors assigned yet">
            Assign mentors to {profile.program.name} first, then allocate hours
            here.
          </EmptyState>
        ) : (
          <Table
            columns={[
              { label: "Mentor" },
              { label: "Allocated", align: "right" },
              { label: "Completed", align: "right" },
              { label: "Remaining", align: "right" },
              { label: "Use by" },
              { label: "Set allocation" },
            ]}
          >
            {mentors.map((mentor) => {
              const alloc = byMentor.get(mentor.id);
              return (
                <Tr key={mentor.id}>
                  <Td>
                    <div className="font-medium text-ink">
                      {mentor.name ?? "—"}
                    </div>
                    <div className="text-xs text-muted-fg">{mentor.email}</div>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatHours(alloc?.allocated ?? 0)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatHours(alloc?.completed ?? 0)}
                  </Td>
                  <Td
                    align="right"
                    className={`font-medium tabular-nums ${
                      (alloc?.remaining ?? 0) < 0 ? "text-red-700" : "text-ink"
                    }`}
                  >
                    {formatHours(alloc?.remaining ?? 0)}
                  </Td>
                  <Td>
                    <Deadline
                      deadline={alloc?.deadline ?? null}
                      remaining={alloc?.remaining ?? 0}
                    />
                  </Td>
                  <Td>
                    <AllocateHoursForm
                      studentProfileId={profile.id}
                      mentorId={mentor.id}
                      currentHours={alloc?.allocated ?? 0}
                      currentDeadline={
                        alloc?.deadline
                          ? alloc.deadline.toISOString().slice(0, 10)
                          : null
                      }
                    />
                  </Td>
                </Tr>
              );
            })}
          </Table>
        )}
      </section>

      <StudentCorrections
        studentProfileId={profile.id}
        programs={toProgramOptions(programs)}
        currentProgramId={profile.programId}
        currentCohortId={profile.cohortId}
        hasSessions={sessionCount > 0}
      />

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">
          Allocation history
        </h2>
        {profile.allotmentChanges.length === 0 ? (
          <EmptyState>No allocation changes yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line/60 rounded-lg border border-line bg-surface text-sm">
            {profile.allotmentChanges.map((c) => (
              <li key={c.id} className="flex flex-wrap gap-x-2 px-4 py-3">
                <span className="tabular-nums text-muted-fg">
                  {formatDate(c.createdAt)}
                </span>
                <span>
                  {c.changedBy.name ?? c.changedBy.email} set hours with{" "}
                  {c.mentor.name ?? c.mentor.email}:{" "}
                  <span className="tabular-nums">
                    {formatHours(c.oldHours)} → {formatHours(c.newHours)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
