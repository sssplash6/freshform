"use client";

import { useActionState } from "react";

import { assignMentor } from "@/lib/actions/mentors";
import { ActionFeedback } from "@/components/forms/action-feedback";

const inputClass =
  "w-full rounded-md border border-mist px-3.5 py-2.5 text-[15px] focus:border-navy focus:outline-none";

export function AssignMentorForm({
  mentors,
  cohorts,
}: {
  mentors: { id: string; label: string }[];
  cohorts: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(assignMentor, null);

  return (
    <form
      action={action}
      className="rounded-lg border border-mist bg-white p-4"
    >
      <h2 className="text-base font-semibold text-navy">
        Assign a mentor to a cohort
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        The Calendly link is per mentor-cohort pairing. Re-assigning an
        existing pairing updates its link.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-gray-600">Mentor *</span>
          <select name="mentorId" required className={inputClass}>
            <option value="">Select…</option>
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Cohort *</span>
          <select name="cohortId" required className={inputClass}>
            <option value="">Select…</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Calendly URL *</span>
          <input
            name="calendlyUrl"
            type="url"
            required
            placeholder="https://calendly.com/…"
            className={inputClass}
          />
        </label>
      </div>
      <div className="mt-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
        >
          {pending ? "Assigning…" : "Assign mentor"}
        </button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
