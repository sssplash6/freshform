import Link from "next/link";

import { ArrowLink } from "@/components/arrow-link";
import { BookingLinksForm } from "@/components/forms/booking-link-form";
import { LogSessionForm } from "@/components/forms/log-session-form";
import { MeetingsLog } from "@/components/meetings-log";
import { ScheduledMeetings } from "@/components/scheduled-meetings";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StudentFolderLink } from "@/components/student-folder-link";
import { TelegramHandle } from "@/components/telegram-handle";
import { PageTitle } from "@/components/ui/section";
import { Section } from "@/components/ui/section";
import { Table, Td, Tr, type Column } from "@/components/ui/table";
import {
  ASSIGNMENT_PROGRESS,
  SESSION_STATUS,
  USER_STATUS,
} from "@/lib/constants";
import { deadlinePassed } from "@/lib/deadlines";
import { requireMentor } from "@/lib/dal";
import { ensureDeadlineReminders } from "@/lib/deadline-reminders";
import { formatDuration } from "@/lib/format";
import { initials } from "@/lib/person-tone";
import { prisma } from "@/lib/prisma";
import { mentorAssignments, mentorMeetings, recentMeetings } from "@/lib/queries";
import { DeadlineText, StatusChip } from "@/components/ui/status-chip";

type MentorStudent = {
  profile: {
    id: string;
    programId: string;
    telegramUsername: string | null;
    folderUrl: string | null;
    user: { name: string | null; email: string; status: string };
    program: { name: string };
    cohort: { name: string } | null;
  };
  allocated: number;
  completed: number;
  missed: number;
  /** Hours delivered on top of the plan: outside every total beside it, but a
   *  row of zeros would otherwise deny work this mentor actually did. */
  extra: number;
  remaining: number;
  deadline: Date | null;
  expired: boolean;
  approved: boolean;
  /** Unassigned hours the student holds — loggable by any mentor; set only on
   *  students this mentor has no allocation of their own with. */
  pool?: number;
};

/** Island that toggles the students view between all programs and one. */
function ProgramToggleIsland({
  href,
  name,
  active,
  students,
  remaining,
  completed,
}: {
  href: string;
  name: string;
  active: boolean;
  students: number;
  remaining: number;
  completed: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`block rounded-lg border p-5 transition ${
        active
          ? "border-accent bg-accent-soft shadow-sm"
          : "border-line bg-surface hover:border-accent/60 hover:shadow-sm"
      }`}
    >
      <h3 className="text-lg font-semibold text-ink">{name}</h3>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-fg">
            Students
          </dt>
          <dd className="text-xl font-bold tabular-nums text-ink">
            {students}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-fg">
            Hrs done
          </dt>
          <dd className="text-xl font-bold tabular-nums text-accent-ink">
            {formatDuration(completed)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-fg">
            Hrs left
          </dt>
          <dd
            className={`text-xl font-bold tabular-nums ${
              remaining < 0 ? "text-red-700" : "text-ink"
            }`}
          >
            {formatDuration(remaining)}
          </dd>
        </div>
      </dl>
    </Link>
  );
}

export default async function MentorHomePage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string }>;
}) {
  const user = await requireMentor();
  await ensureDeadlineReminders();
  const viewer = { audience: "mentor" as const, userId: user.id, now: new Date() };
  const { program = "" } = await searchParams;

  if (user.status === USER_STATUS.UNASSIGNED) {
    return (
      <div className="rounded-lg border border-accent/40 bg-accent-soft p-6">
        <h1 className="text-2xl font-bold text-ink">
          Welcome, {user.name ?? user.email}
        </h1>
        <p className="mt-2 text-sm text-muted-fg">
          Your mentor account is created but not yet assigned to a program.
          An admin needs to assign you before you can see students or log
          sessions, so check back soon.
        </p>
      </div>
    );
  }

  // A mentor's students are the ones an admin allocated time to FROM this
  // mentor — plus, further down, students in their programs holding unassigned
  // hours, which any mentor may log against (logging carves them to whoever
  // did the meeting), and anyone they have logged a session with. That last
  // group is why the list can't be read off the allocations alone: a mentor in
  // the program may log without holding a grant, and a student they just
  // recorded a meeting for must not vanish from the list that leads to them.
  const [
    assignments,
    allocations,
    poolAllocations,
    mySessionSums,
    delivered,
    myMeetings,
    myDiary,
    myGoals,
  ] = await Promise.all([
      mentorAssignments(user.id),
      prisma.hourAllocation.findMany({
        where: { mentorId: user.id },
        include: {
          student: {
            include: { user: true, program: true, cohort: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.hourAllocation.findMany({
        where: { mentorId: null },
        include: {
          student: {
            include: { user: true, program: true, cohort: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      // Every active session, split by plan: the in-plan rows are the balances
      // (hours given out of plan never shrink what a student still holds), and
      // the whole set names the students this mentor has met — including any
      // they have only ever given extra time to.
      prisma.session.groupBy({
        by: ["studentId", "attended", "withinPlan"],
        where: { mentorId: user.id, status: SESSION_STATUS.ACTIVE },
        _sum: { minutes: true },
      }),
      // The headline tallies, which DO want the out-of-plan hours — they are
      // hours this mentor delivered — so the split comes back in the grouping.
      prisma.session.groupBy({
        by: ["attended", "withinPlan"],
        where: { mentorId: user.id, status: SESSION_STATUS.ACTIVE },
        _sum: { minutes: true },
        _count: true,
      }),
      recentMeetings({ mentorId: user.id, take: 8 }),
      mentorMeetings(user.id),
      // Goals an admin gave THIS mentor, plus goals with no mentor yet —
      // logging against an unassigned one is how it becomes theirs.
      prisma.assignment.findMany({
        where: { OR: [{ mentorId: user.id }, { mentorId: null }] },
        orderBy: [{ studentId: "asc" }, { position: "asc" }],
        select: {
          id: true,
          studentId: true,
          mentorId: true,
          purpose: true,
          progress: true,
        },
      }),
    ]);

  const goalsByStudent = new Map<string, { value: string; label: string }[]>();
  for (const g of myGoals) {
    const list = goalsByStudent.get(g.studentId) ?? [];
    // Done goals stay pickable: a mentor may log a final session for work an
    // admin has already ticked off, and hiding it would strand those hours.
    list.push({
      value: g.id,
      label:
        g.progress === ASSIGNMENT_PROGRESS.DONE
          ? `${g.purpose} (done)`
          : g.mentorId === null
            ? `${g.purpose} (unassigned)`
            : g.purpose,
    });
    goalsByStudent.set(g.studentId, list);
  }

  const usedByStudent = new Map<string, number>();
  const missedByStudent = new Map<string, number>();
  const extraByStudent = new Map<string, number>();
  for (const s of mySessionSums) {
    const hrs = s._sum.minutes ?? 0;
    if (!s.withinPlan) {
      extraByStudent.set(
        s.studentId,
        (extraByStudent.get(s.studentId) ?? 0) + hrs
      );
      continue;
    }
    usedByStudent.set(s.studentId, (usedByStudent.get(s.studentId) ?? 0) + hrs);
    if (!s.attended) {
      missedByStudent.set(
        s.studentId,
        (missedByStudent.get(s.studentId) ?? 0) + hrs
      );
    }
  }
  const students: MentorStudent[] = allocations.map((a) => {
    const used = usedByStudent.get(a.studentId) ?? 0;
    const missed = missedByStudent.get(a.studentId) ?? 0;
    const expired = deadlinePassed(a.deadline);
    return {
      profile: a.student,
      allocated: a.minutes,
      completed: used - missed,
      missed,
      extra: extraByStudent.get(a.studentId) ?? 0,
      // Unused hours on an expired allocation are forfeited.
      remaining: expired ? Math.min(0, a.minutes - used) : a.minutes - used,
      deadline: a.deadline,
      expired,
      approved: a.student.user.status === USER_STATUS.ACTIVE,
    };
  });

  // Students in this mentor's programs holding live unassigned time: loggable
  // by any mentor there, so they belong on the list before any are theirs.
  // Skipped once the mentor holds their own allocation (their row already
  // exists — their sessions draw their own hours, not the pool), and once the
  // pool is empty or expired (nothing left to log against).
  const inScope = (s: { programId: string; cohortId: string | null }) =>
    assignments.some(
      (a) =>
        a.programId === s.programId &&
        (!a.cohortId || a.cohortId === s.cohortId)
    );
  const mine = new Set(allocations.map((a) => a.studentId));
  for (const p of poolAllocations) {
    if (mine.has(p.studentId)) continue;
    if (p.minutes <= 0 || deadlinePassed(p.deadline)) continue;
    if (!inScope(p.student)) continue;
    students.push({
      profile: p.student,
      allocated: 0,
      completed: 0,
      missed: 0,
      extra: extraByStudent.get(p.studentId) ?? 0,
      remaining: 0,
      deadline: p.deadline,
      expired: false,
      approved: p.student.user.status === USER_STATUS.ACTIVE,
      pool: p.minutes,
    });
  }

  // Students this mentor has met but holds no allocation for: they may log in
  // their program without a grant, and an admin may remove an allocation after
  // the fact. The meetings happened either way, so the student stays on the
  // list — with the in-plan hours showing as the overdraw they are, since
  // nothing was ever allotted to draw them from.
  const listed = new Set(students.map((s) => s.profile.id));
  const metIds = [...new Set(mySessionSums.map((s) => s.studentId))].filter(
    (id) => !listed.has(id)
  );
  const met = metIds.length
    ? await prisma.studentProfile.findMany({
        where: { id: { in: metIds } },
        include: { user: true, program: true, cohort: true },
      })
    : [];
  for (const p of met) {
    const used = usedByStudent.get(p.id) ?? 0;
    const missed = missedByStudent.get(p.id) ?? 0;
    listed.add(p.id);
    students.push({
      profile: p,
      allocated: 0,
      completed: used - missed,
      missed,
      extra: extraByStudent.get(p.id) ?? 0,
      remaining: -used,
      deadline: null,
      expired: false,
      approved: p.user.status === USER_STATUS.ACTIVE,
    });
  }

  // Everyone else in this mentor's programs. Not students of theirs — nothing
  // has been allocated and nothing logged — so they stay off the table and out
  // of every total on it, and appear only in the log form's picker, which is
  // exactly as far as the mentor's authority reaches: they may record a meeting
  // with anyone in a program they work in, and the "Whose hours?" tick decides
  // whether it charges.
  const loggable = assignments.length
    ? await prisma.studentProfile.findMany({
        where: {
          id: { notIn: [...listed] },
          user: { status: USER_STATUS.ACTIVE },
          OR: assignments.map((a) =>
            a.cohortId
              ? { programId: a.programId, cohortId: a.cohortId }
              : { programId: a.programId }
          ),
        },
        include: { user: true, program: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // Mentor-wide delivered vs. missed hours and total session count.
  const deliveredMinutes = delivered
    .filter((d) => d.withinPlan && d.attended)
    .reduce((sum, d) => sum + (d._sum.minutes ?? 0), 0);
  const missedMinutes = delivered
    .filter((d) => d.withinPlan && !d.attended)
    .reduce((sum, d) => sum + (d._sum.minutes ?? 0), 0);
  const extraMinutes = delivered
    .filter((d) => !d.withinPlan)
    .reduce((sum, d) => sum + (d._sum.minutes ?? 0), 0);
  const sessionsLogged = delivered.reduce((sum, d) => sum + d._count, 0);

  // One toggle island per assigned program, plus "all programs".
  const assignedPrograms = new Map<string, string>();
  for (const a of assignments) {
    if (!assignedPrograms.has(a.programId)) {
      assignedPrograms.set(a.programId, a.program.name);
    }
  }
  const selected = assignedPrograms.has(program) ? program : "";
  const visible = selected
    ? students.filter((s) => s.profile.programId === selected)
    : students;

  const islandStats = (pid: string) => {
    const ss = students.filter((s) => s.profile.programId === pid);
    return {
      students: ss.length,
      remaining: ss.reduce((sum, s) => sum + s.remaining, 0),
      completed: ss.reduce((sum, s) => sum + s.completed, 0),
    };
  };

  const studentColumns: Column[] = [
    { label: "Student" },
    { label: "Telegram" },
    { label: "Folder" },
    { label: "Allocated to you", align: "right" },
    { label: "Completed", align: "right" },
    { label: "Missed", align: "right" },
    { label: "Remaining", align: "right" },
    { label: "Use by" },
    { label: "" },
  ];

  const byProgram = new Map<string, { name: string; students: MentorStudent[] }>();
  for (const s of visible) {
    const key = s.profile.programId;
    if (!byProgram.has(key)) {
      byProgram.set(key, { name: s.profile.program.name, students: [] });
    }
    byProgram.get(key)!.students.push(s);
  }

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow="Mentor"
        title={`Hi, ${user.name?.split(" ")[0] ?? "there"}`}
        subtitle={`Assigned to ${
          assignments
            .map((a) =>
              a.cohort ? `${a.program.name} / ${a.cohort.name}` : a.program.name
            )
            .join(", ") || "no programs yet"
        }.`}
      />

      <StatCardGrid>
        <StatCard label="Students" value={String(students.length)} />
        <StatCard label="Sessions logged" value={String(sessionsLogged)} />
        <StatCard
          label="Time delivered"
          value={formatDuration(deliveredMinutes)}
        />
        {missedMinutes > 0 && (
          <StatCard label="Time missed" value={formatDuration(missedMinutes)} />
        )}
        {extraMinutes > 0 && (
          <StatCard
            label="Time beyond plan"
            value={formatDuration(extraMinutes)}
            tone="muted"
          />
        )}
        <StatCard label="Programs" value={String(assignedPrograms.size)} />
      </StatCardGrid>

      {assignedPrograms.size > 1 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ProgramToggleIsland
            href="/mentor"
            name="All programs"
            active={!selected}
            students={students.length}
            remaining={students.reduce((sum, s) => sum + s.remaining, 0)}
            completed={students.reduce((sum, s) => sum + s.completed, 0)}
          />
          {[...assignedPrograms.entries()].map(([id, name]) => (
            <ProgramToggleIsland
              key={id}
              href={`/mentor?program=${id}`}
              name={name}
              active={selected === id}
              {...islandStats(id)}
            />
          ))}
        </div>
      )}

      {/* What is still ahead comes before the log of what is behind: a mentor
          opening this page needs to know who they are seeing on Thursday, and
          which of those has not answered yet. */}
      <ScheduledMeetings
        meetings={myDiary}
        viewer={viewer}
        title="Your diary"
        emptyBody="Open a student and schedule an interview; it appears here once it's booked."
      />

      <MeetingsLog
        sessions={myMeetings}
        title="Your recent meetings"
        eyebrow="Logged by you"
        emptyBody="Log a session at the bottom of this page and it appears here."
        moreHref="/mentor/sessions"
        moreLabel="All your sessions"
      />

      {visible.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-[15px] text-muted-fg">
          {selected
            ? "No students have time allocated with you in this program yet — you can still log a meeting with anyone in it using the form below."
            : "No students have time allocated with you yet. An admin assigns those, but you can already log a meeting with anyone in your programs using the form below."}
        </p>
      ) : (
        [...byProgram.entries()].map(([programId, group]) => (
          <Section key={programId}
              eyebrow="Your students"
              title={group.name}
              caption={`${group.students.length} student${
                group.students.length === 1 ? "" : "s"
              } · ${formatDuration(
                group.students.reduce((sum, s) => sum + s.remaining, 0),
              )} remaining with you`}
      >
            <Table columns={studentColumns} framed={false}>
              {group.students.map((s, i) => (
                <Tr
                  key={s.profile.id}
                  className="deal-in"
                  style={{ animationDelay: `${Math.min(i, 14) * 24}ms` }}
                >
                  <Td>
                    <Link
                      href={`/mentor/students/${s.profile.id}`}
                      className="group block"
                    >
                      <span className="flex flex-wrap items-center gap-2 font-medium text-ink group-hover:text-brand">
                        {s.profile.user.name ?? "—"}
                        {!s.approved && (
                          <StatusChip severity="attention">Pending approval</StatusChip>
                        )}
                        {s.pool != null && (
                          <StatusChip severity="neutral">
                            {formatDuration(s.pool)} unassigned
                          </StatusChip>
                        )}
                        {s.extra > 0 && (
                          <StatusChip severity="neutral">
                            {formatDuration(s.extra)} extra
                          </StatusChip>
                        )}
                      </span>
                      <span className="block text-xs text-muted-fg">
                        {s.profile.user.email}
                      </span>
                    </Link>
                  </Td>
                  <Td label="Telegram">
                    {s.profile.telegramUsername ? (
                      <TelegramHandle username={s.profile.telegramUsername} />
                    ) : (
                      <span className="text-muted-fg">—</span>
                    )}
                  </Td>
                  <Td label="Folder">
                    {s.profile.folderUrl ? (
                      <StudentFolderLink url={s.profile.folderUrl} />
                    ) : (
                      <span className="text-muted-fg">—</span>
                    )}
                  </Td>
                  <Td
                    label="Allocated to you"
                    align="right"
                    className="tabular-nums"
                  >
                    {formatDuration(s.allocated)}
                  </Td>
                  <Td label="Completed" align="right" className="tabular-nums">
                    {formatDuration(s.completed)}
                  </Td>
                  <Td
                    label="Missed"
                    align="right"
                    className={`tabular-nums ${
                      s.missed > 0 ? "text-amber-700" : "text-muted-fg"
                    }`}
                  >
                    {s.missed > 0 ? formatDuration(s.missed) : "—"}
                  </Td>
                  <Td
                    label="Remaining"
                    align="right"
                    className={`font-medium tabular-nums ${
                      s.remaining < 0 ? "text-red-700" : "text-ink"
                    }`}
                  >
                    {formatDuration(s.remaining)}
                  </Td>
                  <Td label="Use by">
                    <DeadlineText deadline={s.deadline} now={viewer.now} />
                  </Td>
                  <Td align="right">
                    <ArrowLink
                      href={`/mentor/students/${s.profile.id}`}
                      className="text-[13px]"
                    >
                      View
                    </ArrowLink>
                  </Td>
                </Tr>
              ))}
            </Table>
          </Section>
        ))
      )}

      {assignments.length > 0 && (
        <BookingLinksForm
          assignments={assignments.map((a) => ({
            id: a.id,
            label: a.cohort
              ? `${a.program.name} / ${a.cohort.name}`
              : a.program.name,
            calendlyUrl: a.calendlyUrl,
          }))}
        />
      )}

      <LogSessionForm
        students={[
          ...visible
            .filter((s) => s.approved && !s.expired)
            // Name on the first line, the numbers on the second: the picker is
            // scanned by who, then confirmed by how much. Both lines are
            // searchable, so the email is there to be typed at, not read.
            .map((s) => ({
              profileId: s.profile.id,
              label: s.profile.user.name ?? s.profile.user.email,
              hint:
                s.pool != null
                  ? `${formatDuration(s.pool)} unassigned — logging makes them yours · ${s.profile.program.name} · ${s.profile.user.email}`
                  : s.allocated > 0
                    ? `${formatDuration(s.remaining)} left with you · ${s.profile.program.name} · ${s.profile.user.email}`
                    : `No time allocated to you · ${s.profile.program.name} · ${s.profile.user.email}`,
              goals: goalsByStudent.get(s.profile.id) ?? [],
            })),
          // Then everyone else in the mentor's programs, last because they are
          // the least likely pick — but pickable, so a meeting that happened
          // before any hours were granted can still be recorded today.
          ...loggable
            .filter((p) => !selected || p.programId === selected)
            .map((p) => ({
              profileId: p.id,
              label: p.user.name ?? p.user.email,
              hint: `No time allocated to you · ${p.program.name} · ${p.user.email}`,
              goals: goalsByStudent.get(p.id) ?? [],
            })),
        ]}
      />
    </div>
  );
}
