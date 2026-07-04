import { CreateStudentForm } from "@/components/forms/create-student-form";
import { StudentsTable } from "@/components/students-table";
import { cohortOptions, studentsWithHours } from "@/lib/queries";

export default async function AdminStudentsPage() {
  const [cohorts, students] = await Promise.all([
    cohortOptions(),
    studentsWithHours(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-navy">Students</h1>
      <CreateStudentForm
        cohorts={cohorts.map((c) => ({
          id: c.id,
          label: `${c.program.name} / ${c.name}`,
        }))}
        allowInitialHours
      />
      <StudentsTable students={students} showProgram showAllotmentEditor />
    </div>
  );
}
