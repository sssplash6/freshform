import { ProgramStudentsIsland } from "@/components/program-students-island";
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
      <h1 className="text-3xl font-bold tracking-tight text-ink">Students</h1>
      {program ? (
        <ProgramStudentsIsland
          program={toProgramOptions([program])[0]}
          students={students}
        />
      ) : (
        <p className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Your account isn&apos;t linked to a program. Ask an admin to fix the
          staff configuration.
        </p>
      )}
    </div>
  );
}
