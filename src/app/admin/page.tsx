import Link from "next/link";

import { ArrowLink } from "@/components/arrow-link";
import { ApproveStudentButtons } from "@/components/forms/approve-student-buttons";
import { CreateProgramForm } from "@/components/forms/program-forms";
import { ArrowRightIcon } from "@/components/icons";
import { MeetingsLog } from "@/components/meetings-log";
import { ProgramIslandCard } from "@/components/program-island-card";
import { Figure, FigureRow } from "@/components/ui/figure";
import { Callout } from "@/components/ui/callout";
import { PageTitle } from "@/components/ui/section";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { ensureDeadlineReminders } from "@/lib/deadline-reminders";
import { formatDate, formatDuration } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  recentMeetings,
  studentsWithHours,
  taskOptionsForSessions,
  type StudentWithHours,
} from "@/lib/queries";
import { requireRole } from "@/lib/dal";

function totals(students: StudentWithHours[]) {
  return students.reduce(
    (acc, s) => ({
      allotted: acc.allotted + s.allottedMinutes,
      completed: acc.completed + s.completedMinutes,
      missed: acc.missed + s.missedMinutes,
      remaining: acc.remaining + s.remainingMinutes,
    }),
    { allotted: 0, completed: 0, missed: 0, remaining: 0 }
  );
}

/**
 * Cross-program dashboard: one island per running program with its vitals;
 * each island expands into the program's own page with everything in it.
 * Pending self-signups are approved right here.
 */
export default async function AdminHomePage() {
  await requireRole(ROLES.ADMIN);
  await ensureDeadlineReminders();

  const [programs, students, assignments, unassignedMentors, meetings] =
    await Promise.all([
      prisma.program.findMany({
        include: { cohorts: true },
        orderBy: { name: "asc" },
      }),
      studentsWithHours(),
      prisma.mentorAssignment.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.user.count({
        where: { role: ROLES.MENTOR, status: USER_STATUS.UNASSIGNED },
      }),
      recentMeetings({ take: 10 }),
    ]);


  const meetingTasks = await taskOptionsForSessions(meetings);
  const overall = totals(students);
  const pending = students.filter(
    (s) => s.user.status === USER_STATUS.PENDING
  );

  return (
    <div className="space-y-8">
      <PageTitle
        eyebrow="Freshman Academy"
        title="Cross-program dashboard"
        subtitle={`${students.length} student${students.length === 1 ? "" : "s"} across ${programs.length} program${programs.length === 1 ? "" : "s"}, ${formatDuration(overall.remaining)} mentoring time still to deliver.`}
        actions={
          unassignedMentors > 0 && (
            <Link
              href="/admin/mentors"
              className="group inline-flex items-center gap-1.5 rounded-lg border border-accent/60 bg-surface px-3 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-soft"
            >
              {unassignedMentors} mentor{unassignedMentors === 1 ? "" : "s"}{" "}
              awaiting assignment
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )
        }
      />

      {pending.length > 0 && (
        <Callout
          tone="warn"
          title={`Pending approvals (${pending.length})`}
        >
          These students signed up themselves. Approve them, then allocate
          their time from mentors in their program via “Manage”.
          <ul className="mt-3 divide-y divide-warn-line">
            {pending.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-ink">
                    {s.user.name ?? s.user.email}
                  </div>
                  <div className="text-xs text-muted-fg">
                    {s.user.email} · {s.program.name}
                    {s.cohort ? ` / ${s.cohort.name}` : ""}
                    {s.telegramUsername ? ` · @${s.telegramUsername}` : ""} ·
                    signed up {formatDate(s.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ApproveStudentButtons studentProfileId={s.id} />
                  <ArrowLink
                    href={`/admin/students/${s.id}`}
                    className="text-[13px]"
                  >
                    Manage
                  </ArrowLink>
                </div>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <FigureRow>
        <Figure label="Students" value={String(students.length)} />
        <Figure label="Time allotted" value={formatDuration(overall.allotted)} />
        <Figure
          label="Time completed"
          value={formatDuration(overall.completed)}
        />
        {overall.missed > 0 && (
          <Figure label="Time missed" value={formatDuration(overall.missed)} />
        )}
        <Figure
          label="Time remaining"
          value={formatDuration(overall.remaining)}
          tone={overall.remaining < 0 ? "danger" : "ink"}
        />
      </FigureRow>

      <MeetingsLog
        sessions={meetings}
        title="Latest meetings"
        eyebrow="Logged by mentors · every program"
        emptyBody="Nothing has been logged across the programs yet."
        mentorBase="/admin/mentors"
        manage={{ isAdmin: true, tasksBySession: meetingTasks }}
      />

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">
            Programs currently running
          </h2>
          <CreateProgramForm />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => {
            const ps = students.filter((s) => s.programId === p.id);
            const pt = totals(ps);
            const mentorCount = new Set(
              assignments
                .filter((a) => a.programId === p.id)
                .map((a) => a.mentorId)
            ).size;
            return (
              <ProgramIslandCard
                key={p.id}
                name={p.name}
                href={`/admin/programs/${p.id}`}
                cohortCount={p.cohorts.length}
                stats={[
                  { label: "Students", value: String(ps.length) },
                  { label: "Mentors", value: String(mentorCount) },
                  {
                    label: "Hrs left",
                    value: formatDuration(pt.remaining),
                    danger: pt.remaining < 0,
                    brand: pt.remaining >= 0,
                  },
                ]}
                caption={`${formatDuration(pt.completed)} of ${formatDuration(pt.allotted)} completed`}
                completion={{ completed: pt.completed, allotted: pt.allotted }}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
