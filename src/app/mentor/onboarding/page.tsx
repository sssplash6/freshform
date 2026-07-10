import { redirect } from "next/navigation";

import { MentorProfileForm } from "@/components/forms/mentor-profile-form";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";

/**
 * Self-signup step 2 for mentors: a freshly signed-up mentor confirms their
 * full name before reaching the dashboard. Google sign-in doesn't always
 * supply a name, so we ask rather than fall back to labeling them by email.
 */
export default async function MentorOnboardingPage() {
  const user = await requireRole(ROLES.MENTOR);
  if (user.name?.trim()) redirect("/mentor");

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-navy">
          Complete your registration
        </h1>
        <p className="mt-1.5 text-base text-gray-500">
          Tell us your full name so students and staff see who you are. An
          admin will assign you to cohorts before you can log sessions.
        </p>
      </div>
      <div className="rounded-lg border border-mist bg-white p-6">
        <MentorProfileForm defaultName={user.name ?? ""} />
      </div>
    </div>
  );
}
