import { ROLES, USER_STATUS } from "@/lib/constants";
import { requireRole } from "@/lib/dal";

export default async function MentorHomePage() {
  const user = await requireRole(ROLES.MENTOR);

  if (user.status === USER_STATUS.UNASSIGNED) {
    return (
      <div className="rounded-lg border border-brand/40 bg-brand/5 p-6">
        <h1 className="text-xl font-semibold text-navy">
          Welcome, {user.name ?? user.email}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Your mentor account is created but not yet assigned to any cohorts.
          An admin needs to assign you before you can see students or log
          sessions — check back soon.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-navy">My students</h1>
      <p className="mt-2 text-sm text-gray-500">
        Coming next: students in your assigned cohorts, session logging, and
        totals.
      </p>
    </div>
  );
}
