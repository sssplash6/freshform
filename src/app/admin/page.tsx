import Link from "next/link";

import { CreateProgramForm } from "@/components/forms/program-forms";
import { ArrowRightIcon } from "@/components/icons";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { ensureDeadlineReminders } from "@/lib/deadline-reminders";
import { formatHours } from "@/lib/format";
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
 * each island opens the program's own page with everything in it.
 */
export default async function AdminHomePage() {
  await ensureDeadlineReminders();

  const [programs, students, assignments, unassignedMentors, pendingStudents] =
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
      prisma.user.count({
        where: { role: ROLES.STUDENT, status: USER_STATUS.PENDING },
      }),
    ]);

  const overall = totals(students);

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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-navy">
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
              <Link
                key={p.id}
                href={`/admin/programs/${p.id}`}
                className="group block rounded-lg border border-mist bg-white p-5 transition hover:border-brand/60 hover:shadow-sm"
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
                <p className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-navy">
                  Open program
                  <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
