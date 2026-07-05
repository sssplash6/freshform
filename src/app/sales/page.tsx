import { ProgramDashboard } from "@/components/program-dashboard";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";

export default async function SalesHomePage() {
  const user = await requireRole(ROLES.SALES);
  return (
    <ProgramDashboard
      programId={user.programId ?? ""}
      studentsHref="/sales/students"
    />
  );
}
