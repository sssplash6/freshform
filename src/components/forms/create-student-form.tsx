"use client";

import { useActionState } from "react";

import { createStudent } from "@/lib/actions/students";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { Select } from "@/components/select";

const inputClass =
  "w-full rounded-md border border-mist px-3.5 py-2.5 text-[15px] focus:border-navy focus:outline-none";

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
      <h2 className="text-base font-semibold text-navy">Add a student</h2>
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
        <div className="block text-sm">
          <span className="text-gray-600">Cohort *</span>
          <div className="mt-0.5">
            <Select
              name="cohortId"
              ariaLabel="Cohort"
              options={cohorts.map((c) => ({ value: c.id, label: c.label }))}
            />
          </div>
        </div>
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
