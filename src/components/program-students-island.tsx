import Link from "next/link";

import { AddStudentsForm } from "@/components/forms/add-students-form";
import { StudentsTable } from "@/components/students-table";
import { formatHours } from "@/lib/format";
import type { ProgramOption, StudentWithHours } from "@/lib/queries";

/**
 * One program "island": the program's own add-students form and student
 * list in a single box, so each program is managed in its own space.
 * `programHref` (admin) makes the header open the program's full page.
 */
export function ProgramStudentsIsland({
  program,
  students,
  manageBase,
  programHref,
}: {
  program: ProgramOption;
  students: StudentWithHours[];
  manageBase?: string;
  programHref?: string;
}) {
  const totals = students.reduce(
    (acc, s) => ({
      allotted: acc.allotted + s.allottedHours,
      completed: acc.completed + s.completedHours,
    }),
    { allotted: 0, completed: 0 }
  );

  return (
    <section className="rounded-lg border border-mist bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-mist px-4 py-3">
        <h2 className="text-base font-semibold text-navy">
          {programHref ? (
            <Link href={programHref} className="hover:text-brand-deep">
              {program.name} →
            </Link>
          ) : (
            program.name
          )}
        </h2>
        <p className="text-xs text-gray-500">
          {students.length} student{students.length === 1 ? "" : "s"} ·{" "}
          {formatHours(totals.completed)} of {formatHours(totals.allotted)}{" "}
          hours completed
        </p>
      </div>
      <div className="border-b border-mist px-4 py-3">
        <AddStudentsForm program={program} />
      </div>
      <StudentsTable
        students={students}
        showProgram={false}
        showCohort={program.cohorts.length > 0}
        manageBase={manageBase}
        framed={false}
      />
    </section>
  );
}
