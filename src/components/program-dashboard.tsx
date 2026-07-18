import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StudentsTable } from "@/components/students-table";
import { LinkButton } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
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
    studentsWithHours({ programId }),
  ]);

  if (!program) {
    return (
      <Callout tone="danger" title="No program linked">
        Your account isn&apos;t linked to a program. Ask an admin to fix the
        staff configuration.
      </Callout>
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

  // Programs without cohorts (all but Global Admissions) get one flat table.
  const byCohort = new Map<string, StudentWithHours[]>();
  for (const s of students) {
    const cohort = s.cohort?.name ?? "";
    if (!byCohort.has(cohort)) byCohort.set(cohort, []);
    byCohort.get(cohort)!.push(s);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-navy">
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
        <EmptyState
          title={`No students in ${program.name} yet`}
          action={
            <LinkButton href={studentsHref} variant="secondary" size="sm">
              Add students
            </LinkButton>
          }
        >
          Add students by email to start tracking their mentoring hours.
        </EmptyState>
      ) : (
        [...byCohort.entries()].map(([cohortName, cohortStudents]) => (
          <section key={cohortName || "program"}>
            {cohortName && (
              <h2 className="mb-1 text-sm font-medium text-gray-600">
                {cohortName}
              </h2>
            )}
            <StudentsTable
              students={cohortStudents}
              showProgram={false}
              showCohort={Boolean(cohortName)}
            />
          </section>
        ))
      )}
    </div>
  );
}
