import { CreateStudentForm } from "@/components/forms/create-student-form";
import { StudentsTable } from "@/components/students-table";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { cohortOptions, studentsWithHours } from "@/lib/queries";

export default async function LeaderStudentsPage() {
  const user = await requireRole(ROLES.DEPT_LEADER);
  const [cohorts, students] = await Promise.all([
    cohortOptions(user.programId ?? undefined),
    studentsWithHours({ cohort: { programId: user.programId ?? "" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-navy">Students</h1>
      <CreateStudentForm
        cohorts={cohorts.map((c) => ({ id: c.id, label: c.name }))}
      />
      <StudentsTable students={students} showProgram={false} />
    </div>
  );
}
