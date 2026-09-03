import Link from "next/link";
import { notFound } from "next/navigation";

import { MeetingsLog } from "@/components/meetings-log";
import { PersonChip } from "@/components/person-chip";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { Table, Td, Tr, type Column } from "@/components/ui/table";
import {
  ASSIGNMENT_PROGRESS,
  ASSIGNMENT_PROGRESS_GLYPH,
  ASSIGNMENT_PROGRESS_LABELS,
  ASSIGNMENT_PROGRESS_STATUS,
  ROLES,
  USER_STATUS,
} from "@/lib/constants";
import { MASTERS_PROGRAM_NAME } from "../../../../../config/app-config";
import { formatDate, formatDuration, formatMinutes, formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  programTasks,
  recentMeetings,
  studentsWithHours,
  taskOptionsForSessions,
  type ProgramTask,
  type StudentWithHours,
} from "@/lib/queries";
import { requireRole } from "@/lib/dal";
import { StatusChip } from "@/components/ui/status-chip";
import type { Severity } from "@/lib/status";
import { severityOrNeutral } from "@/lib/status";

const DAY = 24 * 60 * 60 * 1000;
/** How far ahead a use-by date starts counting as "worth doing something about". */
const DEADLINE_HORIZON = 14 * DAY;

type Flag = { label: string; severity: Severity };

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
    flags.push({ label: "Pending approval", severity: "attention" });
  }
  if (student.allottedMinutes === 0) {
    flags.push({ label: "No time allocated", severity: "attention" });
  } else if (openTaskCount === 0) {
    flags.push({ label: "No open task", severity: "attention" });
  }
  if (student.remainingMinutes < 0) {
    flags.push({
      label: `Over by ${formatDuration(-student.remainingMinutes)}`,
      severity: "problem",
    });
  }
  if (student.forfeitedMinutes > 0) {
    flags.push({
      label: `${formatDuration(student.forfeitedMinutes)} expired unused`,
      severity: "problem",
    });
  }
  if (
    nextDeadline &&
    student.remainingMinutes > 0 &&
    nextDeadline.getTime() - Date.now() < DEADLINE_HORIZON
  ) {
    flags.push({
      label: `${formatDuration(student.remainingMinutes)} expires ${formatDate(nextDeadline)}`,
      severity: "attention",
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
  await requireRole(ROLES.ADMIN);
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
      allotted: acc.allotted + s.allottedMinutes,
      completed: acc.completed + s.completedMinutes,
      missed: acc.missed + s.missedMinutes,
      remaining: acc.remaining + s.remainingMinutes,
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
    { label: "Mentor" },
    { label: "Logged", align: "right" },
    { label: "Budget", align: "right" },
    { label: "Progress" },
  ];
  const shownTasks = openTasks.slice(0, 8);
  const plannedMinutes = openTasks.reduce((sum, t) => sum + (t.minuteLimit ?? 0), 0);

  return (
    <div className="space-y-8">
      <StatCardGrid>
        <StatCard label="Students" value={String(students.length)} />
        <StatCard label="Mentors" value={String(mentorCount)} />
        <StatCard
          label="Time completed"
          value={formatDuration(totals.completed)}
          tone="brand"
        />
        {totals.missed > 0 && (
          <StatCard label="Time missed" value={formatDuration(totals.missed)} />
        )}
        <StatCard
          label="Time remaining"
          value={formatDuration(totals.remaining)}
        />
        {isMasters && (
          <StatCard label="Total paid" value={formatMoney(totalPaid)} />
        )}
      </StatCardGrid>

      {attention.length > 0 && (
        <Section
            eyebrow="Worth a look"
            title="Needs attention"
            caption={`${attention.length} of ${students.length} student${students.length === 1 ? "" : "s"}`}
      >
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
                    <StatusChip key={f.label} severity={f.severity}>
                      {f.label}
                    </StatusChip>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <MeetingsLog
        sessions={recentSessions}
        title="Latest meetings"
        eyebrow={`Logged by mentors · ${program.name}`}
        emptyBody={`No sessions logged in ${program.name} yet.`}
        mentorBase="/admin/mentors"
        manage={{ isAdmin: true, tasksBySession: meetingTasks }}
      />

      <Section
          eyebrow="What the time is for"
          title="Tasks in flight"
          caption={
            openTasks.length === 0
              ? "Nothing open"
              : `${openTasks.length} open · ${formatDuration(plannedMinutes)} budgeted${openTasks.length > shownTasks.length ? ` · showing ${shownTasks.length}` : ""}`
          }
      >
        {openTasks.length === 0 ? (
          <EmptyState framed={false} title="No open tasks">
            Tasks arrive with the time an admin allocates for them — open a
            student and allocate time to start one.
          </EmptyState>
        ) : (
          <Table framed={false} columns={taskColumns}>
            {shownTasks.map((task: ProgramTask, i) => (
              <Tr
                key={task.id}
                className="deal-in"
                style={{ animationDelay: `${Math.min(i, 14) * 24}ms` }}
              >
                <Td className="sm:max-w-xs">
                  <span className="font-medium text-ink">{task.purpose}</span>
                </Td>
                <Td label="Student">
                  <Link
                    href={`/admin/students/${task.studentId}`}
                    className="text-ink hover:text-brand"
                  >
                    {task.student.user.name ?? task.student.user.email}
                  </Link>
                </Td>
                <Td label="Mentor">
                  {task.mentor ? (
                    <PersonChip
                      person={task.mentor}
                      size="sm"
                      href={`/admin/mentors/${task.mentor.id}`}
                    />
                  ) : (
                    <StatusChip severity="attention">Needs a mentor</StatusChip>
                  )}
                </Td>
                <Td
                  label="Logged"
                  align="right"
                  className={`tabular-nums ${
                    task.minuteLimit != null && task.loggedMinutes > task.minuteLimit
                      ? "font-semibold text-amber-700"
                      : task.loggedMinutes > 0
                        ? "text-ink"
                        : "text-muted-fg"
                  }`}
                >
                  {task.loggedMinutes > 0 ? formatMinutes(task.loggedMinutes) : "—"}
                </Td>
                <Td
                  label="Budget"
                  align="right"
                  className="font-semibold tabular-nums text-ink"
                >
                  {task.minuteLimit == null ? (
                    <span className="font-normal text-muted-fg">—</span>
                  ) : (
                    formatMinutes(task.minuteLimit)
                  )}
                </Td>
                <Td label="Progress">
                  <StatusChip
          severity={severityOrNeutral(ASSIGNMENT_PROGRESS_STATUS[task.progress])}
          glyph={ASSIGNMENT_PROGRESS_GLYPH[task.progress]}
        >
                    {ASSIGNMENT_PROGRESS_LABELS[task.progress] ?? task.progress}
                  </StatusChip>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Section>

      <Section
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
      >
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
                  <StatusChip severity="ok">Booking link set</StatusChip>
                ) : (
                  <StatusChip severity="attention">No booking link</StatusChip>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
