"use client";

import { useActionState } from "react";

import { logSession } from "@/lib/actions/sessions";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { Select } from "@/components/select";

const inputClass =
  "w-full rounded-md border border-line px-3.5 py-2.5 text-[15px] focus:border-brand focus:outline-none";

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
      className="rounded-lg border border-line bg-surface p-4"
    >
      <h2 className="text-base font-semibold text-ink">
        Log a completed session
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="block text-sm">
          <span className="text-muted-fg">Student *</span>
          <div className="mt-0.5">
            <Select
              name="studentProfileId"
              ariaLabel="Student"
              options={students.map((s) => ({
                value: s.profileId,
                label: s.label,
              }))}
            />
          </div>
        </div>
        <label className="block text-sm">
          <span className="text-muted-fg">Hours *</span>
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
          <span className="text-muted-fg">Date *</span>
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
          <span className="text-muted-fg">Task focused on</span>
          <input
            name="task"
            type="text"
            placeholder="Optional — e.g. personal statement draft"
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-fg">Note</span>
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
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "Logging…" : "Log session"}
        </button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
