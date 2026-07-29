import { notFound } from "next/navigation";

import { AddMentorForm } from "@/components/forms/add-mentor-form";
import { AllocationRowActions } from "@/components/forms/allocation-row-actions";
import { Deadline } from "@/components/deadline";
import { Chip } from "@/components/chip";
import { ApproveStudentButtons } from "@/components/forms/approve-student-buttons";
import { StatCard } from "@/components/stat-card";
import { StudentCorrections } from "@/components/forms/student-corrections";
import { StudentFolderForm } from "@/components/forms/student-folder-form";
import { StudentFolderLink } from "@/components/student-folder-link";
import { StudentLedger } from "@/components/student-ledger";
import { PersonChip } from "@/components/person-chip";
import { TelegramHandle } from "@/components/telegram-handle";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Tr, type Column } from "@/components/ui/table";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { MASTERS_PROGRAM_NAME } from "../../../../../config/app-config";
import { formatDate, formatHours, formatMoney, toDateInputValue } from "@/lib/format";
import { allocationSummary } from "@/lib/hours";
import { initials } from "@/lib/person-tone";
import { prisma } from "@/lib/prisma";
import { programOptions, studentLedger, toProgramOptions } from "@/lib/queries";

/**
 * Admin detail page for one student: the full ledger (meetings log the mentors
 * filled in, plus the assignment plan the admin owns), then the hour
 * allocations behind it. This is the only place hours are granted and the only
 * place assignments are edited.
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
  const [allMentors, hours, programs, ledger] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ role: ROLES.MENTOR }, { isMentor: true }] },
      orderBy: [{ name: "asc" }],
    }),
    allocationSummary(profile.id),
    programOptions(),
    studentLedger(profile.id),
  ]);
  const isMasters = profile.program.name === MASTERS_PROGRAM_NAME;
  // The student's mentors are those with an allocation; any other mentor can
  // be added below (and pulled into this program if needed).
  const allocatedIds = new Set(hours.perMentor.map((m) => m.mentor.id));
  const mentorOptions = allMentors.map((m) => ({
    value: m.id,
    label: m.name ?? m.email,
  }));
  const eligibleMentors = mentorOptions.filter((m) => !allocatedIds.has(m.value));

  return (
    <div className="space-y-8">
      <PageHeader
        backHref={`/admin/programs/${profile.programId}`}
        backLabel={profile.program.name}
        eyebrow={`Student · ${profile.program.name}`}
        monogram={initials(profile.user.name, profile.user.email)}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {profile.user.name ?? profile.user.email}
            {isPending && <Chip tone="amber">Pending approval</Chip>}
          </span>
        }
        subtitle={
          <>
            {profile.user.email}
            {profile.cohort ? ` · ${profile.cohort.name}` : ""}
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
            )}
            {profile.folderUrl && (
              <>
                {" · "}
                <StudentFolderLink
                  url={profile.folderUrl}
                  className="align-middle"
                />
              </>
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

      <StudentLedger
        sessions={ledger.sessions}
        assignments={ledger.assignments}
        totals={hours}
        studentProfileId={profile.id}
        mentors={mentorOptions}
        manage
        extraStats={
          <>
            <StatCard
              label="Mentors"
              value={String(hours.perMentor.length)}
              tone="muted"
            />
            {isMasters && (
              <StatCard label="Total paid" value={formatMoney(hours.paid)} />
            )}
          </>
        }
      />

      <Panel tone="total">
        <PanelHeader
          tone="total"
          eyebrow="Granted by an admin"
          title="Hours by mentor"
          caption="What sessions draw down, and the date each pool expires"
        />
        {hours.perMentor.length === 0 ? (
          <EmptyState framed={false} title="No mentors yet">
            Add a mentor below to allocate this student&apos;s hours.
          </EmptyState>
        ) : (
          <Table
            framed={false}
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
            {hours.perMentor.map((m, i) => (
              <Tr
                key={m.mentor.id}
                className="deal-in"
                style={{ animationDelay: `${Math.min(i, 14) * 24}ms` }}
              >
                <Td>
                  <PersonChip person={m.mentor} size="sm" />
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
                    currentDeadline={toDateInputValue(m.deadline)}
                    showAmountPaid={isMasters}
                    currentAmountPaid={m.amountPaid}
                  />
                </Td>
              </Tr>
            ))}
          </Table>
        )}
        {eligibleMentors.length > 0 && (
          <div className="border-t border-line px-4 py-4 sm:px-5">
            <AddMentorForm
              studentProfileId={profile.id}
              mentors={eligibleMentors}
              showAmountPaid={isMasters}
            />
          </div>
        )}
      </Panel>

      <StudentFolderForm
        studentProfileId={profile.id}
        currentFolderUrl={profile.folderUrl}
      />

      <StudentCorrections
        studentProfileId={profile.id}
        programs={toProgramOptions(programs)}
        currentProgramId={profile.programId}
        currentCohortId={profile.cohortId}
        hasSessions={ledger.sessions.length > 0}
      />

      <Panel>
        <PanelHeader
          eyebrow="Audit trail"
          title="Allocation history"
          caption="Every change to this student's hours, and who made it"
        />
        {profile.allotmentChanges.length === 0 ? (
          <EmptyState framed={false}>No allocation changes yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line/60 text-sm">
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
      </Panel>
    </div>
  );
}
