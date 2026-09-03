import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLink } from "@/components/arrow-link";
import { AllocationRowActions } from "@/components/forms/allocation-row-actions";
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
import {
  ASSIGNMENT_PROGRESS,
  canActAsMentor,
  ROLES,
  USER_STATUS,
} from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { MASTERS_PROGRAM_NAME } from "../../../../../config/app-config";
import { formatDate, formatDuration, formatMinutes, formatMoney, toDateInputValue } from "@/lib/format";
import { allocationSummary } from "@/lib/hours";
import { initials } from "@/lib/person-tone";
import { prisma } from "@/lib/prisma";
import {
  programOptions,
  studentLedger,
  studentMeetings,
  taskOptionsForSessions,
  toProgramOptions,
} from "@/lib/queries";
import { DeadlineText, StatusChip } from "@/components/ui/status-chip";

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
  const [allMentors, hours, programs, ledger, meetings] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ role: ROLES.MENTOR }, { isMentor: true }] },
      orderBy: [{ name: "asc" }],
    }),
    allocationSummary(profile.id),
    programOptions(),
    studentLedger(profile.id),
    studentMeetings(profile.id),
  ]);
  // What each logged session could be re-attached to, so a mis-picked task is
  // fixable from the log itself.
  const tasksBySession = await taskOptionsForSessions(ledger.sessions);
  const isMasters = profile.program.name === MASTERS_PROGRAM_NAME;

  // The jump back to the mentor view, offered only when that view would open —
  // it needs hours with this student, a session with them, or a program the
  // me mentors in, the same three answers `/mentor/students/[id]` asks for.
  // The switch in the header can't work this out from a path, so the page that
  // holds the ledger answers it here, and an admin who doesn't mentor this
  // student is never handed a link to a 404.
  // Free but for the assignment lookup: the allocations and every session are
  // already in hand.
  const me = await requireRole(ROLES.ADMIN);
  // One instant for the whole page: the ledger's two columns and every row in
  // them are judged against the same "now".
  const viewer = { audience: "staff" as const, userId: me.id, now: new Date() };
  const mentorsThem =
    canActAsMentor(me) &&
    (hours.perMentor.some((m) => m.mentor?.id === me.id) ||
      ledger.sessions.some((s) => s.mentorId === me.id) ||
      (await prisma.mentorAssignment.findFirst({
        where: {
          mentorId: me.id,
          programId: profile.programId,
          OR: [
            { cohortId: null },
            ...(profile.cohortId ? [{ cohortId: profile.cohortId }] : []),
          ],
        },
      })) !== null);
  const mentorOptions = allMentors.map((m) => ({
    value: m.id,
    label: m.name ?? m.email,
  }));

  // Assigning a task works for any mentor: one who already holds hours here gets
  // topped up, one who doesn't is pulled into the program by the same action.
  // What they hold is right below in Time by mentor, so the picker stays names.

  // Their open tasks, so granting more hours for work already underway tops that
  // budget up instead of starting a second row with the same name.
  const openTasksByMentor: Record<
    string,
    { purpose: string; hint?: string }[]
  > = {};
  for (const task of ledger.assignments) {
    if (task.progress === ASSIGNMENT_PROGRESS.DONE) continue;
    // "" keys the unassigned pool's own open tasks.
    (openTasksByMentor[task.mentorId ?? ""] ??= []).push({
      purpose: task.purpose,
      hint:
        task.minuteLimit != null
          ? `${formatMinutes(task.loggedMinutes)} of ${formatMinutes(task.minuteLimit)}`
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
        actions={
          mentorsThem ? (
            // Marked so the Alt+M shortcut can find it: this link is the only
            // thing on the page that knows the mentor view opens for them.
            <span data-profile-counterpart="true">
              <ArrowLink href={`/mentor/students/${profile.id}`}>
                Open mentor view
              </ArrowLink>
            </span>
          ) : undefined
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {profile.user.name ?? profile.user.email}
            {isPending && (
              <StatusChip severity="attention">Pending approval</StatusChip>
            )}
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
          Until approved, the student can&apos;t use their time and mentors
          can&apos;t log sessions for them.
        </Callout>
      )}

      <StudentLedger
        viewer={viewer}
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
        scheduled={meetings}
        extraStats={
          <>
            <StatCard
              label="Mentors"
              value={String(hours.perMentor.filter((m) => m.mentor).length)}
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
          title="Time by mentor"
          caption="What sessions draw down, and the date each pool expires"
        />
        {hours.perMentor.length === 0 ? (
          <EmptyState framed={false} title="No time yet">
            Time appears here as they&apos;re granted in the panel above — under
            their mentor, or unassigned until one is chosen.
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
                key={m.mentor?.id ?? "unassigned"}
                className="deal-in"
                style={{ animationDelay: `${Math.min(i, 14) * 24}ms` }}
              >
                <Td>
                  {m.mentor ? (
                    <PersonChip
                      person={m.mentor}
                      size="sm"
                      href={`/admin/mentors/${m.mentor.id}`}
                    />
                  ) : (
                    // The pool: granted before a mentor was chosen. Its ⋮
                    // corrects or removes it like any other allocation.
                    <StatusChip severity="attention">Needs a mentor</StatusChip>
                  )}
                </Td>
                <Td label="Allocated" align="right" className="tabular-nums">
                  {formatDuration(m.allocated)}
                </Td>
                <Td label="Completed" align="right" className="tabular-nums">
                  {formatDuration(m.completed)}
                </Td>
                <Td
                  label="Missed"
                  align="right"
                  className={`tabular-nums ${
                    m.missed > 0 ? "text-amber-700" : "text-muted-fg"
                  }`}
                >
                  {m.missed > 0 ? formatDuration(m.missed) : "—"}
                </Td>
                <Td
                  label="Remaining"
                  align="right"
                  className={`font-medium tabular-nums ${
                    m.remaining < 0 ? "text-red-700" : "text-ink"
                  }`}
                >
                  {formatDuration(m.remaining)}
                </Td>
                <Td label="Use by">
                  <DeadlineText deadline={m.deadline} now={viewer.now} />
                </Td>
                {isMasters && (
                  <Td label="Paid" align="right" className="tabular-nums">
                    {m.amountPaid != null ? formatMoney(m.amountPaid) : "—"}
                  </Td>
                )}
                <Td align="right">
                  <AllocationRowActions
                    studentProfileId={profile.id}
                    mentorId={m.mentor?.id ?? ""}
                    mentorLabel={
                      m.mentor
                        ? (m.mentor.name ?? m.mentor.email)
                        : "the unassigned time"
                    }
                    currentMinutes={m.allocated}
                    currentDeadline={
                      // Null on a derived row — hours logged by a mentor who
                      // holds no allocation — so the admin picks a use-by date
                      // as they would for any fresh grant.
                      m.deadline ? toDateInputValue(m.deadline) : null
                    }
                    openTasks={openTasksByMentor[m.mentor?.id ?? ""] ?? []}
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
          caption="Every change to this student's time, and who made it"
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
                  {c.changedBy.name ?? c.changedBy.email} set{" "}
                  {c.mentor ? (
                    <>
                      with{" "}
                      <Link
                        href={`/admin/mentors/${c.mentor.id}`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {c.mentor.name ?? c.mentor.email}
                      </Link>
                    </>
                  ) : (
                    "unassigned time"
                  )}
                  :{" "}
                  <span className="tabular-nums">
                    {formatDuration(c.oldMinutes)} → {formatDuration(c.newMinutes)}
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
