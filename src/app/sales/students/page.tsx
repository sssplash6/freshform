import { ProgramStudentsIsland } from "@/components/program-students-island";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { studentsWithHours, toProgramOptions } from "@/lib/queries";

export default async function SalesStudentsPage() {
  const user = await requireRole(ROLES.SALES);
  const [program, students] = await Promise.all([
    prisma.program.findUnique({
      where: { id: user.programId ?? "" },
      include: { cohorts: { orderBy: { name: "asc" } } },
    }),
    studentsWithHours({ programId: user.programId ?? "" }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Students</h1>
      {program ? (
        <ProgramStudentsIsland
          program={toProgramOptions([program])[0]}
          students={students}
        />
      ) : (
        <p className="rounded-lg border border-danger-line bg-danger-soft p-6 text-sm text-danger-ink">
          Your account isn&apos;t linked to a program. Ask an admin to fix the
          staff configuration.
        </p>
      )}
    </div>
  );
}
