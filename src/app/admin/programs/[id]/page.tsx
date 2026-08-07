import Link from "next/link";
import { notFound } from "next/navigation";

import { Chip, type ChipTone } from "@/components/chip";
import { MeetingsLog } from "@/components/meetings-log";
import { PersonChip } from "@/components/person-chip";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Tr, type Column } from "@/components/ui/table";
import {
  ASSIGNMENT_PROGRESS,
  ASSIGNMENT_PROGRESS_LABELS,
  USER_STATUS,
} from "@/lib/constants";
import { MASTERS_PROGRAM_NAME } from "../../../../../config/app-config";
import { formatDate, formatHours, formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  programTasks,
  recentMeetings,
  studentsWithHours,
  taskOptionsForSessions,
  type ProgramTask,
  type StudentWithHours,
} from "@/lib/queries";

const DAY = 24 * 60 * 60 * 1000;
/** How far ahead a use-by date starts counting as "worth doing something about". */
const DEADLINE_HORIZON = 14 * DAY;

const PROGRESS_TONE: Record<string, ChipTone> = {
  NOT_STARTED: "gray",
  IN_PROGRESS: "violet",
  DONE: "green",
};

type Flag = { label: string; tone: ChipTone };

/**
 * What a student's numbers say is wrong. Nothing here is a new rule — each flag
 * is a fact already visible somewhere in the program, gathered so that reading
 * the overview is enough to know where to go next.
 */
function flagsFor(
  student: StudentWithHours,
  openTaskCount: number,
  nextDeadline: Date | undefined
): Flag[] {
  const flags: Flag[] = [];
  if (student.user.status === USER_STATUS.PENDING) {
    flags.push({ label: "Pending approval", tone: "amber" });
  }
  if (student.allottedHours === 0) {
    flags.push({ label: "No hours allocated", tone: "amber" });
  } else if (openTaskCount === 0) {
    flags.push({ label: "No open task", tone: "amber" });
  }
  if (student.remainingHours < 0) {
    flags.push({
      label: `Overdrawn by ${formatHours(-student.remainingHours)}h`,
      tone: "red",
    });
  }
  if (student.forfeitedHours > 0) {
    flags.push({
      label: `${formatHours(student.forfeitedHours)}h expired unused`,
      tone: "red",
    });
  }
  if (
    nextDeadline &&
    student.remainingHours > 0 &&
    nextDeadline.getTime() - Date.now() < DEADLINE_HORIZON
  ) {
    flags.push({
      label: `${formatHours(student.remainingHours)}h due ${formatDate(nextDeadline)}`,
      tone: "amber",
    });
  }
  return flags;
}

/**
 * The program at a glance: its vitals, whatever needs a person, the meetings its
 * mentors logged, the tasks those hours are buying, and who is teaching in it.
 *
 * Reading, not doing — every control that changes the program's shape lives one
 * tab over in Settings, and the student list with its add form lives in Students.
 */
export default async function AdminProgramOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const program = await prisma.program.findUnique({ where: { id } });
  if (!program) notFound();

  const [students, pairings, recentSessions, allocations, tasks] =
    await Promise.all([
      studentsWithHours({ programId: program.id }),
      prisma.mentorAssignment.findMany({
        where: { programId: program.id },
        include: { mentor: true, cohort: true },
        orderBy: { createdAt: "asc" },
      }),
      recentMeetings({ programId: program.id, take: 12 }),
      prisma.hourAllocation.findMany({
        where: { student: { programId: program.id } },
        select: { studentId: true, deadline: true },
      }),
      programTasks(program.id),
    ]);

  const meetingTasks = await taskOptionsForSessions(recentSessions);
  const totals = students.reduce(
    (acc, s) => ({
      allotted: acc.allotted + s.allottedHours,
      completed: acc.completed + s.completedHours,
      missed: acc.missed + s.missedHours,
      remaining: acc.remaining + s.remainingHours,
    }),
    { allotted: 0, completed: 0, missed: 0, remaining: 0 }
  );
  const mentorCount = new Set(pairings.map((p) => p.mentorId)).size;
  const isMasters = program.name === MASTERS_PROGRAM_NAME;
  const totalPaid = students.reduce((sum, s) => sum + s.amountPaid, 0);

  // The nearest use-by date each student is up against, so hours about to expire
  // are visible before they do.
  const nextDeadline = new Map<string, Date>();
  for (const a of allocations) {
    const held = nextDeadline.get(a.studentId);
    if (!held || a.deadline < held) nextDeadline.set(a.studentId, a.deadline);
  }

  const openTasks = tasks.filter(
    (t) => t.progress !== ASSIGNMENT_PROGRESS.DONE
  );
  const openByStudent = new Map<string, number>();
  for (const t of openTasks) {
    openByStudent.set(t.studentId, (openByStudent.get(t.studentId) ?? 0) + 1);
  }

  const attention = students
    .map((student) => ({
      student,
      flags: flagsFor(
        student,
        openByStudent.get(student.id) ?? 0,
        nextDeadline.get(student.id)
      ),
    }))
    .filter((row) => row.flags.length > 0);

  const taskColumns: Column[] = [
    { label: "Task" },
    { label: "Student" },
    { label: "Consultant" },
    { label: "Logged", align: "right" },
    { label: "Budget", align: "right" },
    { label: "Progress" },
  ];
  const shownTasks = openTasks.slice(0, 8);
  const plannedHours = openTasks.reduce((sum, t) => sum + (t.hourLimit ?? 0), 0);

  return (
    <div className="space-y-8">
      <StatCardGrid>
        <StatCard label="Students" value={String(students.length)} />
        <StatCard label="Mentors" value={String(mentorCount)} />
        <StatCard
          label="Hours completed"
          value={formatHours(totals.completed)}
          tone="brand"
        />
        {totals.missed > 0 && (
          <StatCard label="Hours missed" value={formatHours(totals.missed)} />
        )}
        <StatCard
          label="Hours remaining"
          value={formatHours(totals.remaining)}
          tone={totals.remaining < 0 ? "danger" : "default"}
        />
        {isMasters && (
          <StatCard label="Total paid" value={formatMoney(totalPaid)} />
        )}
      </StatCardGrid>

      {attention.length > 0 && (
        <Panel>
          <PanelHeader
            eyebrow="Worth a look"
            title="Needs attention"
            caption={`${attention.length} of ${students.length} student${students.length === 1 ? "" : "s"}`}
          />
          <ul className="divide-y divide-line/60">
            {attention.map(({ student, flags }, i) => (
              <li
                key={student.id}
                className="deal-in flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5"
                style={{ animationDelay: `${Math.min(i, 14) * 24}ms` }}
              >
                <Link
                  href={`/admin/students/${student.id}`}
                  className="text-sm font-medium text-ink hover:text-brand"
                >
                  {student.user.name ?? student.user.email}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5">
                  {flags.map((f) => (
                    <Chip key={f.label} tone={f.tone}>
                      {f.label}
                    </Chip>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <MeetingsLog
        sessions={recentSessions}
        title="Latest meetings"
        eyebrow={`Logged by mentors · ${program.name}`}
        emptyBody={`No sessions logged in ${program.name} yet.`}
        mentorBase="/admin/mentors"
        manage={{ isAdmin: true, tasksBySession: meetingTasks }}
      />

      <Panel tone="plan">
        <PanelHeader
          tone="plan"
          eyebrow="What the hours are for"
          title="Tasks in flight"
          caption={
            openTasks.length === 0
              ? "Nothing open"
              : `${openTasks.length} open · ${formatHours(plannedHours)} hours budgeted${openTasks.length > shownTasks.length ? ` · showing ${shownTasks.length}` : ""}`
          }
        />
        {openTasks.length === 0 ? (
          <EmptyState framed={false} title="No open tasks">
            Tasks arrive with the hours an admin allocates for them — open a
            student and allocate hours to start one.
          </EmptyState>
        ) : (
          <Table framed={false} columns={taskColumns}>
            {shownTasks.map((task: ProgramTask, i) => (
              <Tr
                key={task.id}
                className="deal-in"
                style={{ animationDelay: `${Math.min(i, 14) * 24}ms` }}
              >
                <Td className="max-w-xs">
                  <span className="font-medium text-ink">{task.purpose}</span>
                </Td>
                <Td>
                  <Link
                    href={`/admin/students/${task.studentId}`}
                    className="text-ink hover:text-brand"
                  >
                    {task.student.user.name ?? task.student.user.email}
                  </Link>
                </Td>
                <Td>
                  <PersonChip
                    person={task.mentor}
                    size="sm"
                    href={`/admin/mentors/${task.mentor.id}`}
                  />
                </Td>
                <Td
                  align="right"
                  className={`tabular-nums ${
                    task.hourLimit != null && task.loggedHours > task.hourLimit
                      ? "font-semibold text-amber-700"
                      : task.loggedHours > 0
                        ? "text-ink"
                        : "text-muted-fg"
                  }`}
                >
                  {task.loggedHours > 0 ? formatHours(task.loggedHours) : "—"}
                </Td>
                <Td align="right" className="font-semibold tabular-nums text-ink">
                  {task.hourLimit == null ? (
                    <span className="font-normal text-muted-fg">—</span>
                  ) : (
                    formatHours(task.hourLimit)
                  )}
                </Td>
                <Td>
                  <Chip tone={PROGRESS_TONE[task.progress] ?? "gray"}>
                    {ASSIGNMENT_PROGRESS_LABELS[task.progress] ?? task.progress}
                  </Chip>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow="Teaching here"
          title="Mentors"
          action={
            <Link
              href={`/admin/programs/${program.id}/settings`}
              className="text-sm font-medium text-ink hover:text-accent-ink"
            >
              Assign or remove mentors →
            </Link>
          }
        />
        {pairings.length === 0 ? (
          <EmptyState framed={false} title="No mentors yet">
            Assign mentors to {program.name} in Settings, and their booking links
            appear here as they set them.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line/60 text-sm">
            {pairings.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <PersonChip
                    person={p.mentor}
                    size="sm"
                    href={`/admin/mentors/${p.mentor.id}`}
                  />
                  {p.cohort && (
                    <span className="text-xs text-muted-fg">{p.cohort.name}</span>
                  )}
                </div>
                {p.calendlyUrl ? (
                  <Chip tone="green">Booking link set</Chip>
                ) : (
                  <Chip tone="gray">No booking link yet</Chip>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
