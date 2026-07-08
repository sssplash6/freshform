import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/forms/onboarding-form";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { cohortOptions } from "@/lib/queries";

/**
 * Self-signup step 2: a freshly signed-up student picks their program /
 * cohort and confirms their name, then waits for admin approval.
 */
export default async function StudentOnboardingPage() {
  const user = await requireRole(ROLES.STUDENT);

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
  });
  if (profile) redirect("/student");

  const cohorts = await cohortOptions();

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-navy">
          Complete your registration
        </h1>
        <p className="mt-1.5 text-base text-gray-500">
          Tell us which program and cohort you&apos;re in. An admin will review
          your registration and allocate your mentoring hours.
        </p>
      </div>
      <div className="rounded-lg border border-mist bg-white p-6">
        <OnboardingForm
          defaultName={user.name ?? ""}
          cohorts={cohorts.map((c) => ({
            id: c.id,
            label: `${c.program.name} / ${c.name}`,
          }))}
        />
      </div>
    </div>
  );
}
