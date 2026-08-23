import Link from "next/link";

import { Chip } from "@/components/chip";
import { ArrowLink } from "@/components/arrow-link";
import { Deadline } from "@/components/deadline";
import { BookingLinksForm } from "@/components/forms/booking-link-form";
import { LogSessionForm } from "@/components/forms/log-session-form";
import { MeetingsLog } from "@/components/meetings-log";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StudentFolderLink } from "@/components/student-folder-link";
import { TelegramHandle } from "@/components/telegram-handle";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Tr, type Column } from "@/components/ui/table";
import {
  ASSIGNMENT_PROGRESS,
  SESSION_STATUS,
  USER_STATUS,
} from "@/lib/constants";
import { deadlinePassed } from "@/lib/deadlines";
import { requireMentor } from "@/lib/dal";
import { ensureDeadlineReminders } from "@/lib/deadline-reminders";
import { formatHours } from "@/lib/format";
import { initials } from "@/lib/person-tone";
import { prisma } from "@/lib/prisma";
import { mentorAssignments, recentMeetings } from "@/lib/queries";

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
            {formatHours(completed)}
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
            {formatHours(remaining)}
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

  // A mentor's students are the ones an admin allocated hours to FROM this
  // mentor — plus, further down, students in their programs holding unassigned
  // hours, which any mentor may log against (logging carves them to whoever
  // did the meeting).
  const [
    assignments,
    allocations,
    poolAllocations,
    mySessionSums,
    delivered,
    myMeetings,
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
      prisma.session.groupBy({
        by: ["studentId", "attended"],
        where: { mentorId: user.id, status: SESSION_STATUS.ACTIVE },
        _sum: { hours: true },
      }),
      prisma.session.groupBy({
        by: ["attended"],
        where: { mentorId: user.id, status: SESSION_STATUS.ACTIVE },
        _sum: { hours: true },
        _count: true,
      }),
      recentMeetings({ mentorId: user.id, take: 8 }),
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
  for (const s of mySessionSums) {
    const hrs = s._sum.hours ?? 0;
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
      allocated: a.hours,
      completed: used - missed,
      missed,
      // Unused hours on an expired allocation are forfeited.
      remaining: expired ? Math.min(0, a.hours - used) : a.hours - used,
      deadline: a.deadline,
      expired,
      approved: a.student.user.status === USER_STATUS.ACTIVE,
    };
  });

  // Students in this mentor's programs holding live unassigned hours: loggable
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
    if (p.hours <= 0 || deadlinePassed(p.deadline)) continue;
    if (!inScope(p.student)) continue;
    students.push({
      profile: p.student,
      allocated: 0,
      completed: 0,
      missed: 0,
      remaining: 0,
      deadline: p.deadline,
      expired: false,
      approved: p.student.user.status === USER_STATUS.ACTIVE,
      pool: p.hours,
    });
  }

  // Mentor-wide delivered vs. missed hours and total session count.
  const deliveredHours = delivered
    .filter((d) => d.attended)
    .reduce((sum, d) => sum + (d._sum.hours ?? 0), 0);
  const missedHours = delivered
    .filter((d) => !d.attended)
    .reduce((sum, d) => sum + (d._sum.hours ?? 0), 0);
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
      <PageHeader
        eyebrow="Mentor"
        title={`Hi, ${user.name?.split(" ")[0] ?? "there"}`}
        subtitle={`Assigned to ${
          assignments
            .map((a) =>
              a.cohort ? `${a.program.name} / ${a.cohort.name}` : a.program.name
            )
            .join(", ") || "no programs yet"
        }.`}
        monogram={initials(user.name, user.email)}
      />

      <StatCardGrid>
        <StatCard label="Students" value={String(students.length)} />
        <StatCard label="Sessions logged" value={String(sessionsLogged)} />
        <StatCard
          label="Hours delivered"
          value={formatHours(deliveredHours)}
          tone="brand"
        />
        {missedHours > 0 && (
          <StatCard label="Hours missed" value={formatHours(missedHours)} />
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
            ? "No students have hours allocated with you in this program yet."
            : "No students have hours allocated with you yet. An admin assigns those."}
        </p>
      ) : (
        [...byProgram.entries()].map(([programId, group]) => (
          <Panel key={programId} tone="total">
            <PanelHeader
              tone="total"
              eyebrow="Your students"
              title={group.name}
              caption={`${group.students.length} student${
                group.students.length === 1 ? "" : "s"
              } · ${formatHours(
                group.students.reduce((sum, s) => sum + s.remaining, 0),
              )} hours remaining with you`}
            />
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
                        {!s.approved && <Chip tone="amber">Pending approval</Chip>}
                        {s.pool != null && (
                          <Chip tone="gray">
                            {formatHours(s.pool)}h unassigned
                          </Chip>
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
                    {formatHours(s.allocated)}
                  </Td>
                  <Td label="Completed" align="right" className="tabular-nums">
                    {formatHours(s.completed)}
                  </Td>
                  <Td
                    label="Missed"
                    align="right"
                    className={`tabular-nums ${
                      s.missed > 0 ? "text-amber-700" : "text-muted-fg"
                    }`}
                  >
                    {s.missed > 0 ? formatHours(s.missed) : "—"}
                  </Td>
                  <Td
                    label="Remaining"
                    align="right"
                    className={`font-medium tabular-nums ${
                      s.remaining < 0 ? "text-red-700" : "text-ink"
                    }`}
                  >
                    {formatHours(s.remaining)}
                  </Td>
                  <Td label="Use by">
                    <Deadline deadline={s.deadline} />
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
          </Panel>
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
        students={visible
          .filter((s) => s.approved && !s.expired)
          // Name on the first line, the numbers on the second: the picker is
          // scanned by who, then confirmed by how much. Both lines are
          // searchable, so the email is there to be typed at, not read.
          .map((s) => ({
            profileId: s.profile.id,
            label: s.profile.user.name ?? s.profile.user.email,
            hint:
              s.pool != null
                ? `${formatHours(s.pool)}h unassigned — logging makes them yours · ${s.profile.program.name} · ${s.profile.user.email}`
                : `${formatHours(s.remaining)}h left with you · ${s.profile.program.name} · ${s.profile.user.email}`,
            goals: goalsByStudent.get(s.profile.id) ?? [],
          }))}
      />
    </div>
  );
}
