import { redirect } from "next/navigation";

import {
  CompleteProfileForm,
  OnboardingForm,
} from "@/components/forms/onboarding-form";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { programOptions, toProgramOptions } from "@/lib/queries";

/**
 * First sign-in step. Staff-registered students (the normal path) confirm
 * their full name and Telegram username — their program is already set. The
 * self-signup fallback additionally asks for the program (and cohort, where
 * the program has them), then waits for admin approval.
 */
export default async function StudentOnboardingPage() {
  const user = await requireRole(ROLES.STUDENT);

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { program: true, cohort: true },
  });

  if (profile) {
    if (user.name?.trim() && profile.telegramUsername) redirect("/student");

    return (
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-navy">
            Welcome to {profile.program.name}
          </h1>
          <p className="mt-1.5 text-base text-gray-500">
            You&apos;re registered
            {profile.cohort ? ` in ${profile.cohort.name}` : ""}. Confirm your
            name and Telegram username and you&apos;re all set.
          </p>
        </div>
        <div className="rounded-lg border border-mist bg-white p-6">
          <CompleteProfileForm defaultName={user.name ?? ""} />
        </div>
      </div>
    );
  }

  const programs = await programOptions();

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-navy">
          Complete your registration
        </h1>
        <p className="mt-1.5 text-base text-gray-500">
          Tell us who you are and which program you&apos;re in. An admin will
          review your registration and allocate your mentoring hours.
        </p>
      </div>
      <div className="rounded-lg border border-mist bg-white p-6">
        <OnboardingForm
          defaultName={user.name ?? ""}
          programs={toProgramOptions(programs)}
        />
      </div>
    </div>
  );
}
