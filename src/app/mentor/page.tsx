import Link from "next/link";

import { Chip } from "@/components/chip";
import { ArrowLink } from "@/components/arrow-link";
import { Deadline } from "@/components/deadline";
import { BookingLinksForm } from "@/components/forms/booking-link-form";
import { LogSessionForm } from "@/components/forms/log-session-form";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { SESSION_STATUS, USER_STATUS } from "@/lib/constants";
import { deadlinePassed } from "@/lib/deadlines";
import { requireMentor } from "@/lib/dal";
import { ensureDeadlineReminders } from "@/lib/deadline-reminders";
import { formatHours } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { mentorAssignments } from "@/lib/queries";

type MentorStudent = {
  profile: {
    id: string;
    programId: string;
    telegramUsername: string | null;
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
  // mentor; sessions the mentor logs draw those allocations down.
  const [assignments, allocations, mySessionSums, delivered] =
    await Promise.all([
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
    ]);

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
      <div>
        <h1 className="text-2xl font-bold text-ink">My students</h1>
        <p className="mt-1.5 text-base text-muted-fg">
          Assigned to:{" "}
          {assignments
            .map((a) =>
              a.cohort ? `${a.program.name} / ${a.cohort.name}` : a.program.name
            )
            .join(", ") || "none"}
        </p>
      </div>

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
          .map((s) => ({
            profileId: s.profile.id,
            label: `${s.profile.user.name ?? s.profile.user.email} · ${formatHours(s.remaining)}h left with you (${s.profile.program.name})`,
          }))}
      />

      {visible.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-[15px] text-muted-fg">
          {selected
            ? "No students have hours allocated with you in this program yet."
            : "No students have hours allocated with you yet. An admin assigns those."}
        </p>
      ) : (
        [...byProgram.entries()].map(([programId, group]) => (
          <section
            key={programId}
            className="rounded-xl border border-line bg-surface"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="text-base font-semibold text-ink">
                {group.name}
              </h2>
              <p className="text-xs text-muted-fg">
                {group.students.length} student
                {group.students.length === 1 ? "" : "s"} ·{" "}
                {formatHours(
                  group.students.reduce((sum, s) => sum + s.remaining, 0)
                )}{" "}
                hours remaining with you
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted-fg">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Telegram</th>
                    <th className="px-4 py-3 text-right">Allocated to you</th>
                    <th className="px-4 py-3 text-right">Completed</th>
                    <th className="px-4 py-3 text-right">Missed</th>
                    <th className="px-4 py-3 text-right">Remaining</th>
                    <th className="px-4 py-3">Use by</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {group.students.map((s) => (
                    <tr
                      key={s.profile.id}
                      className="transition-colors hover:bg-canvas"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/mentor/students/${s.profile.id}`}
                          className="group block"
                        >
                          <span className="flex items-center gap-2 font-medium text-ink group-hover:text-ink">
                            {s.profile.user.name ?? "—"}
                            {!s.approved && (
                              <Chip tone="amber">Pending approval</Chip>
                            )}
                          </span>
                          <span className="block text-xs text-muted-fg">
                            {s.profile.user.email}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {s.profile.telegramUsername
                          ? `@${s.profile.telegramUsername}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatHours(s.allocated)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatHours(s.completed)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums ${
                          s.missed > 0 ? "text-amber-700" : "text-muted-fg"
                        }`}
                      >
                        {s.missed > 0 ? formatHours(s.missed) : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium tabular-nums ${
                          s.remaining < 0 ? "text-red-700" : "text-ink"
                        }`}
                      >
                        {formatHours(s.remaining)}
                      </td>
                      <td className="px-4 py-3">
                        <Deadline deadline={s.deadline} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ArrowLink
                          href={`/mentor/students/${s.profile.id}`}
                          className="text-[13px]"
                        >
                          View
                        </ArrowLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
