import { ProgramDashboard } from "@/components/program-dashboard";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";

export default async function LeaderHomePage() {
  const user = await requireRole(ROLES.DEPT_LEADER);
  return (
    <ProgramDashboard
      programId={user.programId ?? ""}
      studentsHref="/leader/students"
    />
  );
}
