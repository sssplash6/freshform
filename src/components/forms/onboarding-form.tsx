"use client";

import { useActionState } from "react";

import { completeOnboarding } from "@/lib/actions/students";
import { ActionFeedback } from "@/components/forms/action-feedback";

const inputClass =
  "w-full rounded-md border border-mist px-3 py-2 text-sm focus:border-navy focus:outline-none";

/** Self-signup step 2: the student picks their cohort and confirms details. */
export function OnboardingForm({
  defaultName,
  cohorts,
}: {
  defaultName: string;
  cohorts: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(completeOnboarding, null);

  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm">
        <span className="text-gray-600">Full name *</span>
        <input
          name="name"
          type="text"
          required
          defaultValue={defaultName}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        <span className="text-gray-600">Your program &amp; cohort *</span>
        <select name="cohortId" required className={inputClass}>
          <option value="">Select…</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit registration"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}
