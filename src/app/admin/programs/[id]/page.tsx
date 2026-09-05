import Link from "next/link";
import { notFound } from "next/navigation";

import { SessionsLog, toSessionEntries } from "@/components/session-row";
import { TaskTable, toTaskEntries } from "@/components/task-row";
import { PersonChip } from "@/components/person-chip";
import { Figure, FigureRow } from "@/components/ui/figure";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLink } from "@/components/ui/link";
import { Section } from "@/components/ui/section";
import {
  ASSIGNMENT_PROGRESS,
  USER_STATUS,
} from "@/lib/constants";
import { formatDate, formatDuration, formatMoney } from "@/lib/format";
import { programTotals } from "@/lib/hours";
import { prisma } from "@/lib/prisma";
import {
  programTasks,
  recentMeetings,
  studentsWithHours,
  taskOptionsForSessions,
  type StudentWithHours,
} from "@/lib/queries";
import { requireProgramScope } from "@/lib/dal";
import { StatusChip } from "@/components/ui/status-chip";
import type { Severity } from "@/lib/status";

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
  const { id } = await params;
  const me = await requireProgramScope(id);
  // One instant for the whole page, so no two sections disagree about today.
  const viewer = { audience: "staff" as const, userId: me.id, now: new Date() };
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
  const totals = programTotals(students);
  const mentorCount = new Set(pairings.map((p) => p.mentorId)).size;
  const tracksPayment = program.tracksPayment;
  

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

  const shownTasks = openTasks.slice(0, 8);
  const plannedMinutes = openTasks.reduce((sum, t) => sum + (t.minuteLimit ?? 0), 0);

  return (
    <div className="space-y-8">
      <FigureRow>
        <Figure label="Students" value={String(students.length)} />
        <Figure label="Mentors" value={String(mentorCount)} />
        <Figure
          label="Time completed"
          value={formatDuration(totals.completed)}
          tone="hours"
        />
        {totals.missed > 0 && (
          <Figure label="Time missed" value={formatDuration(totals.missed)} />
        )}
        <Figure
          label="Time remaining"
          value={formatDuration(totals.remaining)}
        />
        {tracksPayment && (
          <Figure label="Total paid" value={formatMoney(totals.paid)} />
        )}
      </FigureRow>

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

      <SessionsLog
        sessions={toSessionEntries(recentSessions, {
          mentorBase: "/admin/mentors",
        })}
        viewer={viewer}
        title="Latest meetings"
        eyebrow={`Logged by mentors · ${program.name}`}
        empty={
          <EmptyState framed={false} title="No meetings logged yet">
            {`No sessions logged in ${program.name} yet.`}
          </EmptyState>
        }
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
          <TaskTable
            tasks={toTaskEntries(shownTasks, {
              mentorBase: "/admin/mentors",
              studentBase: "/admin/students",
            })}
            viewer={viewer}
            framed={false}
          />
        )}
      </Section>

      <Section
          eyebrow="Teaching here"
          title="Mentors"
          action={
            <ArrowLink
              href={`/admin/programs/${program.id}/settings`}
              className="text-sm"
            >
              Assign or remove mentors
            </ArrowLink>
          }
      >
        {pairings.length === 0 ? (
          <EmptyState framed={false} title="No mentors yet">
            Nobody is assigned to {program.name} yet. Settings pairs a mentor
                with it.
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
