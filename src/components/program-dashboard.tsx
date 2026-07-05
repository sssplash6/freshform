import Link from "next/link";

import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StudentsTable } from "@/components/students-table";
import { formatHours } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { studentsWithHours, type StudentWithHours } from "@/lib/queries";

/**
 * Own-program dashboard shared by Dept Leader and Sales (spec §7): the
 * program's students with completed/remaining hours, grouped by cohort.
 */
export async function ProgramDashboard({
  programId,
  studentsHref,
}: {
  programId: string;
  studentsHref: string;
}) {
  const [program, students] = await Promise.all([
    prisma.program.findUnique({ where: { id: programId } }),
    studentsWithHours({ cohort: { programId } }),
  ]);

  if (!program) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your account isn&apos;t linked to a program. Ask an admin to fix the
        staff configuration.
      </p>
    );
  }

  const overall = students.reduce(
    (acc, s) => ({
      allotted: acc.allotted + s.allottedHours,
      completed: acc.completed + s.completedHours,
      remaining: acc.remaining + s.remainingHours,
    }),
    { allotted: 0, completed: 0, remaining: 0 }
  );

  const byCohort = new Map<string, StudentWithHours[]>();
  for (const s of students) {
    if (!byCohort.has(s.cohort.name)) byCohort.set(s.cohort.name, []);
    byCohort.get(s.cohort.name)!.push(s);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-navy">
        {program.name} dashboard
      </h1>

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
        <p className="rounded-lg border border-mist bg-white p-6 text-sm text-gray-500">
          No students in {program.name} yet.{" "}
          <Link href={studentsHref} className="text-navy underline">
            Create the first one.
          </Link>
        </p>
      ) : (
        [...byCohort.entries()].map(([cohortName, cohortStudents]) => (
          <section key={cohortName}>
            <h2 className="mb-1 text-sm font-medium text-gray-600">
              {cohortName}
            </h2>
            <StudentsTable students={cohortStudents} showProgram={false} />
          </section>
        ))
      )}
    </div>
  );
}
