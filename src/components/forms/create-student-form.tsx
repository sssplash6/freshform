"use client";

import { useActionState } from "react";

import { createStudent } from "@/lib/actions/students";
import { ActionFeedback } from "@/components/forms/action-feedback";

const inputClass =
  "w-full rounded-md border border-mist px-3 py-2 text-sm focus:border-navy focus:outline-none";

export function CreateStudentForm({
  cohorts,
}: {
  cohorts: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(createStudent, null);

  return (
    <form
      action={action}
      className="rounded-lg border border-mist bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-navy">Add a student</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="text-gray-600">Email *</span>
          <input
            name="email"
            type="email"
            required
            placeholder="student@example.com"
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Name</span>
          <input name="name" type="text" className={inputClass} />
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
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create student"}
        </button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
