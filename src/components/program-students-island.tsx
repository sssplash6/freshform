import { AddStudentsForm } from "@/components/forms/add-students-form";
import { StudentsTable } from "@/components/students-table";
import { ArrowLink } from "@/components/ui/link";
import { Section } from "@/components/ui/section";
import { formatDuration } from "@/lib/format";
import type { ProgramOption, StudentWithHours } from "@/lib/queries";

/**
 * One program "island": the program's student list, with its add-students form
 * underneath. The list comes first because reading it is the common visit and
 * adding students is the occasional one.
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
      allotted: acc.allotted + s.allottedMinutes,
      completed: acc.completed + s.completedMinutes,
    }),
    { allotted: 0, completed: 0 }
  );

  return (
    <Section
        eyebrow="Program"
        title={
          programHref ? (
            <ArrowLink href={programHref}>{program.name}</ArrowLink>
          ) : (
            program.name
          )
        }
        caption={`${students.length} student${students.length === 1 ? "" : "s"} · ${formatDuration(totals.completed)} of ${formatDuration(totals.allotted)} completed`}
      >
      <StudentsTable
        students={students}
        showProgram={false}
        showCohort={program.cohorts.length > 0}
        manageBase={manageBase}
        framed={false}
      />
      <div className="border-t border-line px-4 py-4 sm:px-5">
        <AddStudentsForm program={program} />
      </div>
    </Section>
  );
}
