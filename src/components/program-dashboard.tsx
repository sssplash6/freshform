import { Figure, FigureRow } from "@/components/ui/figure";
import { StudentsTable } from "@/components/students-table";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDuration } from "@/lib/format";
import { programTotals } from "@/lib/hours";
import { prisma } from "@/lib/prisma";
import { studentsWithHours, type StudentWithHours } from "@/lib/queries";

/**
 * Own-program dashboard shared by Dept Leader and Sales (spec §7): the
 * program's students with completed/remaining hours, grouped by cohort.
 */
export async function ProgramDashboard({
  programId,
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

  const overall = programTotals(students);

  // Programs without cohorts (all but Global Admissions) get one flat table.
  const byCohort = new Map<string, StudentWithHours[]>();
  for (const s of students) {
    const cohort = s.cohort?.name ?? "";
    if (!byCohort.has(cohort)) byCohort.set(cohort, []);
    byCohort.get(cohort)!.push(s);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-ink">
        {program.name} dashboard
      </h1>

      <FigureRow>
        <Figure label="Students" value={String(students.length)} />
        <Figure label="Time allotted" value={formatDuration(overall.allotted)} />
        <Figure
          label="Time completed"
          value={formatDuration(overall.completed)}
          tone="hours"
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

      {students.length === 0 ? (
        <EmptyState title="Nobody enrolled yet">
          Students are registered by email on the Students page.
        </EmptyState>
      ) : (
        [...byCohort.entries()].map(([cohortName, cohortStudents]) => (
          <section key={cohortName || "program"}>
            {cohortName && (
              <h2 className="mb-1 text-sm font-medium text-muted-fg">
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
