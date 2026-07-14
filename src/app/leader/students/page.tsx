import { CreateStudentForm } from "@/components/forms/create-student-form";
import { StudentsTable } from "@/components/students-table";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { studentsWithHours, toProgramOptions } from "@/lib/queries";

export default async function LeaderStudentsPage() {
  const user = await requireRole(ROLES.DEPT_LEADER);
  const [program, students] = await Promise.all([
    prisma.program.findUnique({
      where: { id: user.programId ?? "" },
      include: { cohorts: { orderBy: { name: "asc" } } },
    }),
    studentsWithHours({ programId: user.programId ?? "" }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-navy">Students</h1>
      {program && (
        <CreateStudentForm programs={toProgramOptions([program])} />
      )}
      <StudentsTable
        students={students}
        showProgram={false}
        showCohort={(program?.cohorts.length ?? 0) > 0}
      />
    </div>
  );
}
