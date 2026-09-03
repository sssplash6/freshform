import { notFound } from "next/navigation";

import { AddStudentsForm } from "@/components/forms/add-students-form";
import { StudentsTable } from "@/components/students-table";
import { Section } from "@/components/ui/section";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { formatDuration } from "@/lib/format";
import { programTotals } from "@/lib/hours";
import { prisma } from "@/lib/prisma";
import { studentsWithHours, toProgramOptions } from "@/lib/queries";

/**
 * Who is in the program: one row per student with their time, each row opening
 * that student's own page. Registering more students sits under the list, since
 * reading it is the common visit and adding to it the occasional one.
 */
export default async function AdminProgramStudentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(ROLES.ADMIN);
  const { id } = await params;
  const program = await prisma.program.findUnique({
    where: { id },
    include: { cohorts: { orderBy: { name: "asc" } } },
  });
  if (!program) notFound();

  const students = await studentsWithHours({ programId: program.id });
  const totals = programTotals(students);
  const programOption = toProgramOptions([program])[0];

  return (
    <div className="space-y-8">
      <Section
          eyebrow="Enrolled"
          title="Students"
          caption={
            students.length === 0
              ? "Nobody enrolled yet"
              : `${students.length} student${students.length === 1 ? "" : "s"} · ${formatDuration(totals.completed)} of ${formatDuration(totals.allotted)} completed`
          }
      >
        <StudentsTable
          students={students}
          showProgram={false}
          showCohort={program.cohorts.length > 0}
          manageBase="/admin/students"
          framed={false}
        />
        <div className="border-t border-line px-4 py-4 sm:px-5">
          <AddStudentsForm program={programOption} />
        </div>
      </Section>
    </div>
  );
}
