import Link from "next/link";
import { FolderIcon, SendIcon } from "@/components/icons";
import { notFound } from "next/navigation";

import { ArrowLink, ExternalLink } from "@/components/ui/link";
import { AllocationRowActions } from "@/components/forms/hours-forms";
import {
  AllocationsTable,
  toAllocationEntries,
} from "@/components/allocation-row";
import { ApproveStudentButtons } from "@/components/forms/approve-student-buttons";
import { Figure } from "@/components/ui/figure";
import { StudentCorrections } from "@/components/forms/student-corrections";
import { StudentFolderForm } from "@/components/forms/student-folder-form";
import { StudentLedger } from "@/components/student-ledger";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/section";
import { Section } from "@/components/ui/section";
import {
  ASSIGNMENT_PROGRESS,
  canActAsMentor,
  ROLES,
  USER_STATUS,
} from "@/lib/constants";
import { canManageStudent, mentorReaches } from "@/lib/authz";
import { requireAdminAccess } from "@/lib/dal";
import { formatDate, formatDuration, formatMinutes, formatMoney, toDateInputValue } from "@/lib/format";
import { allocationSummary } from "@/lib/hours";
import { prisma } from "@/lib/prisma";
import {
  programOptions,
  studentLedger,
  studentMeetings,
  taskOptionsForSessions,
  toProgramOptions,
} from "@/lib/queries";
import { StatusChip } from "@/components/ui/status-chip";

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
  const me = await requireAdminAccess();
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
  // Out of this admin's programs reads exactly like a student who does not
  // exist. Asked before the ledger is fetched, not after it is rendered.
  if (!(await canManageStudent(me, profile))) notFound();

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
  // Whether this program bills per student — a column now, so renaming it
  // cannot turn the money fields off behind everyone's back.
  const tracksPayment = profile.program.tracksPayment;

  // One instant for the whole page: the ledger's two columns and every row in
  // them are judged against the same "now".
  const viewer = { audience: "staff" as const, userId: me.id, now: new Date() };
  // The jump back to the mentor view, offered only when that view would open.
  // The switch in the header cannot work that out from a path, so the page
  // holding the ledger answers it — with the same rule `/mentor/students/[id]`
  // gates on, so an admin who mentors this student is never handed a 404.
  const mentorsThem = canActAsMentor(me) && (await mentorReaches(me, profile));
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
      <PageTitle
        backHref={`/admin/programs/${profile.programId}/students`}
        backLabel={`${profile.program.name} students`}
        eyebrow={`Student · ${profile.program.name}`}
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
                <ExternalLink
                  variant="inline"
                  href={`https://t.me/${profile.telegramUsername}`} icon={<SendIcon className="h-3.5 w-3.5" />} title={`Open @${profile.telegramUsername} on Telegram`} className="align-middle">
@{profile.telegramUsername}
</ExternalLink>
              </>
            ) : (
              " · Telegram not set yet"
            )}
            {profile.folderUrl && (
              <>
                {" · "}
                <ExternalLink
                  variant="inline"
                  href={profile.folderUrl} icon={<FolderIcon className="h-3.5 w-3.5" />} title="Open the student's folder" className="align-middle">
Folder
</ExternalLink>
              </>
            )}{" "}
            · registered {formatDate(profile.createdAt)}
          </>
        }
      />

      {isPending && (
        <Callout
          tone="warn"
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
        showAmountPaid={tracksPayment}
        manage
        manageSessions={{ isAdmin: true, tasksBySession }}
        mentorBase="/admin/mentors"
        scheduled={meetings}
        extraStats={
          <>
            <Figure
              label="Mentors"
              value={String(hours.perMentor.filter((m) => m.mentor).length)}
              tone="muted"
            />
            {tracksPayment && (
              <Figure label="Total paid" value={formatMoney(hours.paid)} />
            )}
          </>
        }
      />

      <Section
          eyebrow="Granted by an admin"
          title="Time by mentor"
          caption="What sessions draw down, and the date each pool expires"
      >
        {hours.perMentor.length === 0 ? (
          <EmptyState framed={false} title="No time yet">
            No time granted yet. The panel above grants it, with or without a
                mentor named.
          </EmptyState>
        ) : (
          <AllocationsTable
            entries={toAllocationEntries(hours.perMentor, {
              mentorBase: "/admin/mentors",
            })}
            viewer={viewer}
            framed={false}
            showAmountPaid={tracksPayment}
            renderActions={(entry) => (
              <AllocationRowActions
                studentProfileId={profile.id}
                mentorId={entry.mentor?.id ?? ""}
                mentorLabel={
                  entry.mentor
                    ? (entry.mentor.name ?? entry.mentor.email)
                    : "the unassigned time"
                }
                currentMinutes={entry.allocated}
                currentDeadline={
                  // Null on a derived row — hours logged by a mentor who holds
                  // no allocation — so the admin picks a use-by date as they
                  // would for any fresh grant.
                  entry.deadline ? toDateInputValue(entry.deadline) : null
                }
                openTasks={openTasksByMentor[entry.mentor?.id ?? ""] ?? []}
                showAmountPaid={tracksPayment}
                currentAmountPaid={entry.amountPaid ?? null}
              />
            )}
          />
        )}
      </Section>

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

      <Section
          eyebrow="Audit trail"
          title="Allocation history"
          caption="Every change to this student's time, and who made it"
      >
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
      </Section>
    </div>
  );
}
