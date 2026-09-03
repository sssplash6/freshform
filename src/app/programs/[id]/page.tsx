import { redirect } from "next/navigation";

import { ROLES, type Role } from "@/lib/constants";
import { requireUser } from "@/lib/dal";

/**
 * `/programs/<id>` — one address for a program, for the same reason
 * `/students/<id>` exists: `lib/status.ts` links here so it never has to know
 * which role is reading.
 *
 * Only staff have a program page today. A mentor sent here — from a
 * `PROGRAM_NO_MENTORS` row they can see but not act on — goes to their own
 * home rather than a page that would refuse them.
 */
export default async function ProgramRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const role = user.role as Role;

  if (role === ROLES.ADMIN || role === ROLES.DEPT_LEADER || role === ROLES.SALES) {
    redirect(`/admin/programs/${id}`);
  }
  redirect("/mentor");
}
