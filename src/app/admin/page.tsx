import Link from "next/link";

import { Chip } from "@/components/chip";
import { ArrowRightIcon } from "@/components/icons";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StudentsTable } from "@/components/students-table";
import { ROLES, SESSION_STATUS, USER_STATUS } from "@/lib/constants";
import { formatDate, formatHours } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { studentsWithHours, type StudentWithHours } from "@/lib/queries";

function totals(students: StudentWithHours[]) {
  return students.reduce(
    (acc, s) => ({
      allotted: acc.allotted + s.allottedHours,
      completed: acc.completed + s.completedHours,
      remaining: acc.remaining + s.remainingHours,
    }),
    { allotted: 0, completed: 0, remaining: 0 }
  );
}

/**
 * Cross-program dashboard: one island per running program with its vitals;
 * picking an island (?program=id) opens that program's monitor below — its
 * students, mentors, and latest sessions in one place.
 */
export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string }>;
}) {
  const { program: selectedId } = await searchParams;

  const [programs, students, assignments, unassignedMentors, pendingStudents] =
    await Promise.all([
      prisma.program.findMany({
        include: { cohorts: true },
        orderBy: { name: "asc" },
      }),
      studentsWithHours(),
      prisma.mentorAssignment.findMany({
        include: { mentor: true, cohort: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.user.count({
        where: { role: ROLES.MENTOR, status: USER_STATUS.UNASSIGNED },
      }),
      prisma.user.count({
        where: { role: ROLES.STUDENT, status: USER_STATUS.PENDING },
      }),
    ]);

  const overall = totals(students);
  const selected = programs.find((p) => p.id === selectedId);

  const studentsOf = (programId: string) =>
    students.filter((s) => s.programId === programId);
  const mentorsOf = (programId: string) => {
    const seen = new Set<string>();
    return assignments
      .filter((a) => a.programId === programId)
      .filter((a) =>
        seen.has(a.mentorId) ? false : (seen.add(a.mentorId), true)
      );
  };

  // The selected program's latest sessions, newest first.
  const recentSessions = selected
    ? await prisma.session.findMany({
        where: { student: { programId: selected.id } },
        include: {
          student: { include: { user: true } },
          mentor: true,
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 10,
      })
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-navy">
          Cross-program dashboard
        </h1>
        <div className="flex items-center gap-2">
          {pendingStudents > 0 && (
            <Link
              href="/admin/students"
              className="group inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
            >
              {pendingStudents} student{pendingStudents === 1 ? "" : "s"}{" "}
              awaiting approval
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          {unassignedMentors > 0 && (
            <Link
              href="/admin/mentors"
              className="group inline-flex items-center gap-1.5 rounded-md border border-brand/60 bg-brand/5 px-3 py-1.5 text-sm font-medium text-brand-deep transition-colors hover:bg-brand/10"
            >
              {unassignedMentors} mentor{unassignedMentors === 1 ? "" : "s"}{" "}
              awaiting assignment
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>

      <StatCardGrid>
        <StatCard label="Students" value={String(students.length)} />
        <StatCard label="Hours allotted" value={formatHours(overall.allotted)} />
        <StatCard
          label="Hours completed"
          value={formatHours(overall.completed)}
          tone="brand"
        />
        <StatCard
          label="Hours remaining"
          value={formatHours(overall.remaining)}
          tone={overall.remaining < 0 ? "danger" : "default"}
        />
      </StatCardGrid>

      <section>
        <h2 className="mb-2 text-base font-semibold text-navy">
          Programs currently running
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => {
            const ps = studentsOf(p.id);
            const pt = totals(ps);
            const mentorCount = mentorsOf(p.id).length;
            const isSelected = p.id === selectedId;
            return (
              <Link
                key={p.id}
                href={isSelected ? "/admin" : `/admin?program=${p.id}`}
                className={`block rounded-lg border bg-white p-5 transition hover:shadow-sm ${
                  isSelected
                    ? "border-brand shadow-sm ring-1 ring-brand/40"
                    : "border-mist hover:border-brand/50"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold text-navy">{p.name}</h3>
                  {p.cohorts.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {p.cohorts.length} cohort{p.cohorts.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                      Students
                    </dt>
                    <dd className="text-xl font-bold tabular-nums text-navy">
                      {ps.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                      Mentors
                    </dt>
                    <dd className="text-xl font-bold tabular-nums text-navy">
                      {mentorCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                      Hrs left
                    </dt>
                    <dd
                      className={`text-xl font-bold tabular-nums ${
                        pt.remaining < 0 ? "text-red-700" : "text-brand-deep"
                      }`}
                    >
                      {formatHours(pt.remaining)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-gray-500">
                  {formatHours(pt.completed)} of {formatHours(pt.allotted)}{" "}
                  hours completed
                </p>
                <p className="mt-2 text-[13px] font-medium text-navy">
                  {isSelected ? "Monitoring — click to close" : "Monitor →"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {selected && (
        <section className="space-y-6 rounded-lg border border-brand/40 bg-brand/[.03] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold tracking-tight text-navy">
              {selected.name} — monitor
            </h2>
            <Link href="/admin" className="text-sm text-gray-500 hover:text-navy">
              Close ✕
            </Link>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-navy">Students</h3>
            <StudentsTable
              students={studentsOf(selected.id)}
              showProgram={false}
              showCohort={selected.cohorts.length > 0}
              manageBase="/admin/students"
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-navy">Mentors</h3>
            {mentorsOf(selected.id).length === 0 ? (
              <p className="rounded-lg border border-mist bg-white p-6 text-sm text-gray-500">
                No mentors assigned to {selected.name} yet.
              </p>
            ) : (
              <ul className="divide-y divide-mist/60 rounded-lg border border-mist bg-white text-sm">
                {mentorsOf(selected.id).map((a) => (
                  <li
                    key={a.mentorId}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <div>
                      <span className="font-medium text-gray-900">
                        {a.mentor.name ?? a.mentor.email}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        {a.mentor.email}
                        {a.cohort ? ` · ${a.cohort.name}` : ""}
                      </span>
                    </div>
                    {a.calendlyUrl ? (
                      <Chip tone="green">Booking link set</Chip>
                    ) : (
                      <Chip tone="gray">No booking link yet</Chip>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-navy">
              Latest sessions
            </h3>
            {recentSessions.length === 0 ? (
              <p className="rounded-lg border border-mist bg-white p-6 text-sm text-gray-500">
                No sessions logged in {selected.name} yet.
              </p>
            ) : (
              <ul className="divide-y divide-mist/60 rounded-lg border border-mist bg-white text-sm">
                {recentSessions.map((s) => (
                  <li key={s.id} className="flex flex-wrap gap-x-2 px-4 py-3">
                    <span className="tabular-nums text-gray-500">
                      {formatDate(s.date)}
                    </span>
                    <span className={s.status === SESSION_STATUS.VOIDED ? "text-gray-400 line-through" : ""}>
                      {s.mentor.name ?? s.mentor.email} ·{" "}
                      {s.student.user.name ?? s.student.user.email} ·{" "}
                      <span className="tabular-nums">{formatHours(s.hours)}h</span>
                      {s.task ? ` · ${s.task}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
