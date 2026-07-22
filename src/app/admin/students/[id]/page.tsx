import { notFound } from "next/navigation";

import { AddMentorForm } from "@/components/forms/add-mentor-form";
import { AllocationRowActions } from "@/components/forms/allocation-row-actions";
import { Deadline } from "@/components/deadline";
import { Chip } from "@/components/chip";
import { ApproveStudentButtons } from "@/components/forms/approve-student-buttons";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StudentCorrections } from "@/components/forms/student-corrections";
import { TelegramHandle } from "@/components/telegram-handle";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Tr, type Column } from "@/components/ui/table";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { MASTERS_PROGRAM_NAME } from "../../../../../config/app-config";
import { formatDate, formatHours, formatMoney } from "@/lib/format";
import { allocationSummary } from "@/lib/hours";
import { prisma } from "@/lib/prisma";
import { programOptions, toProgramOptions } from "@/lib/queries";

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
  const [allMentors, hours, programs, sessionCount] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ role: ROLES.MENTOR }, { isMentor: true }] },
      orderBy: [{ name: "asc" }],
    }),
    allocationSummary(profile.id),
    programOptions(),
    prisma.session.count({ where: { studentId: profile.id } }),
  ]);
  const isMasters = profile.program.name === MASTERS_PROGRAM_NAME;
  // The student's mentors are those with an allocation; any other mentor can
  // be added below (and pulled into this program if needed).
  const allocatedIds = new Set(hours.perMentor.map((m) => m.mentor.id));
  const eligibleMentors = allMentors
    .filter((m) => !allocatedIds.has(m.id))
    .map((m) => ({ value: m.id, label: m.name ?? m.email }));

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
                {" · "}
                <TelegramHandle
                  username={profile.telegramUsername}
                  className="align-middle"
                />
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
          tone={hours.remaining < 0 ? "danger" : "default"}
        />
        <StatCard label="Mentors" value={String(hours.perMentor.length)} />
        {isMasters && (
          <StatCard label="Total paid" value={formatMoney(hours.paid)} />
        )}
      </StatCardGrid>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">
          Hour allocations by mentor
        </h2>
        {hours.perMentor.length === 0 ? (
          <EmptyState title="No mentors yet">
            Add a mentor below to allocate this student&apos;s hours.
          </EmptyState>
        ) : (
          <Table
            columns={[
              { label: "Mentor" },
              { label: "Allocated", align: "right" },
              { label: "Completed", align: "right" },
              { label: "Missed", align: "right" },
              { label: "Remaining", align: "right" },
              { label: "Use by" },
              ...(isMasters
                ? [{ label: "Paid", align: "right" } as Column]
                : []),
              { label: "", align: "right" },
            ]}
          >
            {hours.perMentor.map((m) => (
              <Tr key={m.mentor.id}>
                <Td>
                  <div className="font-medium text-ink">
                    {m.mentor.name ?? "—"}
                  </div>
                  <div className="text-xs text-muted-fg">{m.mentor.email}</div>
                </Td>
                <Td align="right" className="tabular-nums">
                  {formatHours(m.allocated)}
                </Td>
                <Td align="right" className="tabular-nums">
                  {formatHours(m.completed)}
                </Td>
                <Td
                  align="right"
                  className={`tabular-nums ${
                    m.missed > 0 ? "text-amber-700" : "text-muted-fg"
                  }`}
                >
                  {m.missed > 0 ? formatHours(m.missed) : "—"}
                </Td>
                <Td
                  align="right"
                  className={`font-medium tabular-nums ${
                    m.remaining < 0 ? "text-red-700" : "text-ink"
                  }`}
                >
                  {formatHours(m.remaining)}
                </Td>
                <Td>
                  <Deadline deadline={m.deadline} />
                </Td>
                {isMasters && (
                  <Td align="right" className="tabular-nums">
                    {m.amountPaid != null ? formatMoney(m.amountPaid) : "—"}
                  </Td>
                )}
                <Td align="right">
                  <AllocationRowActions
                    studentProfileId={profile.id}
                    mentorId={m.mentor.id}
                    mentorLabel={m.mentor.name ?? m.mentor.email}
                    currentHours={m.allocated}
                    currentDeadline={m.deadline.toISOString().slice(0, 10)}
                    showAmountPaid={isMasters}
                    currentAmountPaid={m.amountPaid}
                  />
                </Td>
              </Tr>
            ))}
          </Table>
        )}
        {eligibleMentors.length > 0 && (
          <AddMentorForm
            studentProfileId={profile.id}
            mentors={eligibleMentors}
            showAmountPaid={isMasters}
          />
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
          <ul className="divide-y divide-line/60 rounded-xl border border-line bg-surface text-sm">
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
