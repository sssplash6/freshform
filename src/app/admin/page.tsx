import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StudentsTable } from "@/components/students-table";
import { ROLES, USER_STATUS } from "@/lib/constants";
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

export default async function AdminHomePage() {
  const [students, unassignedMentors, pendingStudents] = await Promise.all([
    studentsWithHours(),
    prisma.user.count({
      where: { role: ROLES.MENTOR, status: USER_STATUS.UNASSIGNED },
    }),
    prisma.user.count({
      where: { role: ROLES.STUDENT, status: USER_STATUS.PENDING },
    }),
  ]);

  const overall = totals(students);

  // Group by program, then cohort (input is already sorted by program).
  // Students in programs without cohorts land in the "" group and render as
  // one table without a cohort heading.
  const byProgram = new Map<string, Map<string, StudentWithHours[]>>();
  for (const s of students) {
    const program = s.program.name;
    const cohort = s.cohort?.name ?? "";
    if (!byProgram.has(program)) byProgram.set(program, new Map());
    const cohorts = byProgram.get(program)!;
    if (!cohorts.has(cohort)) cohorts.set(cohort, []);
    cohorts.get(cohort)!.push(s);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
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

      {students.length === 0 ? (
        <p className="rounded-lg border border-mist bg-white p-8 text-[15px] text-gray-500">
          No students yet.{" "}
          <Link href="/admin/students" className="text-navy underline">
            Create the first one.
          </Link>
        </p>
      ) : (
        [...byProgram.entries()].map(([programName, cohorts]) => {
          const programStudents = [...cohorts.values()].flat();
          const pt = totals(programStudents);
          return (
            <section key={programName}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-navy">
                  {programName}
                </h2>
                <p className="text-xs text-gray-500">
                  {programStudents.length} students ·{" "}
                  {formatHours(pt.completed)} of {formatHours(pt.allotted)}{" "}
                  hours completed
                </p>
              </div>
              <div className="space-y-4">
                {[...cohorts.entries()].map(([cohortName, cohortStudents]) => (
                  <div key={cohortName || "program"}>
                    {cohortName && (
                      <h3 className="mb-1 text-sm font-medium text-gray-600">
                        {cohortName}
                      </h3>
                    )}
                    <StudentsTable
                      students={cohortStudents}
                      showProgram={false}
                      showCohort={Boolean(cohortName)}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
