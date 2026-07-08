"use client";

import { useActionState } from "react";

import { logSession } from "@/lib/actions/sessions";
import { ActionFeedback } from "@/components/forms/action-feedback";

const inputClass =
  "w-full rounded-md border border-mist px-3.5 py-2.5 text-[15px] focus:border-navy focus:outline-none";

export function LogSessionForm({
  students,
}: {
  students: { profileId: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(logSession, null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      action={action}
      className="rounded-lg border border-mist bg-white p-4"
    >
      <h2 className="text-base font-semibold text-navy">
        Log a completed session
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="text-gray-600">Student *</span>
          <select name="studentProfileId" required className={inputClass}>
            <option value="">Select…</option>
            {students.map((s) => (
              <option key={s.profileId} value={s.profileId}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Hours *</span>
          <input
            name="hours"
            type="number"
            min="0.01"
            step="any"
            required
            placeholder="1.5"
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Date *</span>
          <input
            name="date"
            type="date"
            required
            defaultValue={today}
            max={today}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Note</span>
          <input
            name="note"
            type="text"
            placeholder="Optional"
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
          {pending ? "Logging…" : "Log session"}
        </button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
