import Link from "next/link";

import { Chip } from "@/components/chip";
import { ArrowLink } from "@/components/arrow-link";
import { Deadline } from "@/components/deadline";
import { BookingLinksForm } from "@/components/forms/booking-link-form";
import { LogSessionForm } from "@/components/forms/log-session-form";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { SESSION_STATUS, USER_STATUS } from "@/lib/constants";
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
  remaining: number;
  deadline: Date | null;
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
          ? "border-brand bg-brand/5 shadow-sm"
          : "border-mist bg-white hover:border-brand/60 hover:shadow-sm"
      }`}
    >
      <h3 className="text-lg font-semibold text-navy">{name}</h3>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Students
          </dt>
          <dd className="text-xl font-bold tabular-nums text-navy">
            {students}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Hrs done
          </dt>
          <dd className="text-xl font-bold tabular-nums text-brand-deep">
            {formatHours(completed)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Hrs left
          </dt>
          <dd
            className={`text-xl font-bold tabular-nums ${
              remaining < 0 ? "text-red-700" : "text-navy"
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
      <div className="rounded-lg border border-brand/40 bg-brand/5 p-6">
        <h1 className="text-3xl font-bold tracking-tight text-navy">
          Welcome, {user.name ?? user.email}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
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
        by: ["studentId"],
        where: { mentorId: user.id, status: SESSION_STATUS.ACTIVE },
        _sum: { hours: true },
      }),
      prisma.session.aggregate({
        where: { mentorId: user.id, status: SESSION_STATUS.ACTIVE },
        _sum: { hours: true },
        _count: true,
      }),
    ]);

  const completedByStudent = new Map(
    mySessionSums.map((s) => [s.studentId, s._sum.hours ?? 0])
  );
  const students: MentorStudent[] = allocations.map((a) => {
    const completed = completedByStudent.get(a.studentId) ?? 0;
    return {
      profile: a.student,
      allocated: a.hours,
      completed,
      remaining: a.hours - completed,
      deadline: a.deadline,
      approved: a.student.user.status === USER_STATUS.ACTIVE,
    };
  });

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
        <h1 className="text-3xl font-bold tracking-tight text-navy">My students</h1>
        <p className="mt-1.5 text-base text-gray-500">
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
        <StatCard label="Sessions logged" value={String(delivered._count)} />
        <StatCard
          label="Hours delivered"
          value={formatHours(delivered._sum.hours ?? 0)}
          tone="brand"
        />
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
          .filter((s) => s.approved)
          .map((s) => ({
            profileId: s.profile.id,
            label: `${s.profile.user.name ?? s.profile.user.email} · ${formatHours(s.remaining)}h left with you (${s.profile.program.name})`,
          }))}
      />

      {visible.length === 0 ? (
        <p className="rounded-lg border border-mist bg-white p-8 text-[15px] text-gray-500">
          {selected
            ? "No students have hours allocated with you in this program yet."
            : "No students have hours allocated with you yet. An admin assigns those."}
        </p>
      ) : (
        [...byProgram.entries()].map(([programId, group]) => (
          <section
            key={programId}
            className="rounded-lg border border-mist bg-white"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-mist px-4 py-3">
              <h2 className="text-base font-semibold text-navy">
                {group.name}
              </h2>
              <p className="text-xs text-gray-500">
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
                <thead className="border-b border-mist bg-mist/40 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Telegram</th>
                    <th className="px-4 py-3 text-right">Allocated to you</th>
                    <th className="px-4 py-3 text-right">Completed</th>
                    <th className="px-4 py-3 text-right">Remaining</th>
                    <th className="px-4 py-3">Use by</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-mist/60">
                  {group.students.map((s) => (
                    <tr
                      key={s.profile.id}
                      className="transition-colors hover:bg-mist/20"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/mentor/students/${s.profile.id}`}
                          className="group block"
                        >
                          <span className="flex items-center gap-2 font-medium text-gray-900 group-hover:text-navy">
                            {s.profile.user.name ?? "—"}
                            {!s.approved && (
                              <Chip tone="amber">Pending approval</Chip>
                            )}
                          </span>
                          <span className="block text-xs text-gray-500">
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
                        className={`px-4 py-3 text-right font-medium tabular-nums ${
                          s.remaining < 0 ? "text-red-700" : "text-navy"
                        }`}
                      >
                        {formatHours(s.remaining)}
                      </td>
                      <td className="px-4 py-3">
                        <Deadline deadline={s.deadline} remaining={s.remaining} />
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
