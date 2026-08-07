import Link from "next/link";
import { notFound } from "next/navigation";

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
import { ASSIGNMENT_PROGRESS, ROLES, USER_STATUS } from "@/lib/constants";
import { MASTERS_PROGRAM_NAME } from "../../../../../config/app-config";
import { formatDate, formatHours, formatMoney, toDateInputValue } from "@/lib/format";
import { allocationSummary } from "@/lib/hours";
import { initials } from "@/lib/person-tone";
import { prisma } from "@/lib/prisma";
import {
  programOptions,
  studentLedger,
  taskOptionsForSessions,
  toProgramOptions,
} from "@/lib/queries";

/**
 * Admin detail page for one student: the full ledger (the meetings log their
 * mentors filled in, plus the tasks the admin owns), then the hours behind it,
 * per mentor. This is the only place hours are granted and the only place tasks
 * are edited — and granting hours here is what puts a task on a mentor's list.
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
  // What each logged session could be re-attached to, so a mis-picked task is
  // fixable from the log itself.
  const tasksBySession = await taskOptionsForSessions(ledger.sessions);
  const isMasters = profile.program.name === MASTERS_PROGRAM_NAME;
  const mentorOptions = allMentors.map((m) => ({
    value: m.id,
    label: m.name ?? m.email,
  }));

  // Assigning a task works for any mentor: one who already holds hours here gets
  // topped up, one who doesn't is pulled into the program by the same action.
  // What they hold is right below in Hours by mentor, so the picker stays names.

  // Their open tasks, so granting more hours for work already underway tops that
  // budget up instead of starting a second row with the same name.
  const openTasksByMentor: Record<
    string,
    { purpose: string; hint?: string }[]
  > = {};
  for (const task of ledger.assignments) {
    if (task.progress === ASSIGNMENT_PROGRESS.DONE) continue;
    (openTasksByMentor[task.mentorId] ??= []).push({
      purpose: task.purpose,
      hint:
        task.hourLimit != null
          ? `${formatHours(task.loggedHours)} of ${formatHours(task.hourLimit)}h`
          : "no budget yet",
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        backHref={`/admin/programs/${profile.programId}/students`}
        backLabel={`${profile.program.name} students`}
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
        openTasksByMentor={openTasksByMentor}
        showAmountPaid={isMasters}
        manage
        manageSessions={{ isAdmin: true, tasksBySession }}
        mentorBase="/admin/mentors"
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
            A mentor appears here once they&apos;re given a task with hours, in
            the panel above.
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
                  <PersonChip
                    person={m.mentor}
                    size="sm"
                    href={`/admin/mentors/${m.mentor.id}`}
                  />
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
                    openTasks={openTasksByMentor[m.mentor.id] ?? []}
                    showAmountPaid={isMasters}
                    currentAmountPaid={m.amountPaid}
                  />
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Panel>

      <StudentFolderForm
        studentProfileId={profile.id}
        currentFolderUrl={profile.folderUrl}
      />

      <StudentCorrections
        studentProfileId={profile.id}
        currentEmail={profile.user.email}
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
                  <Link
                    href={`/admin/mentors/${c.mentor.id}`}
                    className="font-medium text-ink hover:text-brand"
                  >
                    {c.mentor.name ?? c.mentor.email}
                  </Link>
                  :{" "}
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
