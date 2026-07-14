"use client";

import { useActionState, useState } from "react";

import { createCohort, createProgram } from "@/lib/actions/programs";
import { ActionFeedback } from "@/components/forms/action-feedback";

const inputClass =
  "min-h-11 rounded-md border border-mist px-3.5 py-2 text-sm focus:border-navy focus:outline-none";
const buttonClass =
  "min-h-11 rounded-md bg-navy px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50";

/** Inline "open a new program" control on the admin dashboard. */
export function CreateProgramForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createProgram, null);

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-navy px-3.5 py-2 text-sm font-medium text-navy transition-colors hover:bg-navy hover:text-white"
        >
          New program
        </button>
        <ActionFeedback state={state} />
      </div>
    );
  }

  return (
    <div>
      <form action={action} className="rise-in flex flex-wrap items-center gap-2">
        <input
          name="name"
          type="text"
          required
          autoFocus
          placeholder="Program name"
          className={inputClass}
        />
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Creating…" : "Create program"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 rounded-md px-2.5 py-2 text-sm text-gray-500 transition-colors hover:bg-mist/60"
        >
          Cancel
        </button>
      </form>
      <ActionFeedback state={state} />
    </div>
  );
}

/**
 * Collapsed "add a cohort" control on a program's page. Programs are flat by
 * default, so no input is shown until the admin explicitly reaches for
 * cohorts.
 */
export function CreateCohortForm({ programId }: { programId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createCohort, null);

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-gray-400 transition-colors hover:text-navy"
        >
          + Add a cohort to this program
        </button>
        <ActionFeedback state={state} />
      </div>
    );
  }

  return (
    <div>
      <form action={action} className="rise-in flex flex-wrap items-center gap-2">
        <input type="hidden" name="programId" value={programId} />
        <input
          name="name"
          type="text"
          required
          autoFocus
          placeholder="e.g. Cohort 1"
          className={inputClass}
        />
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Adding…" : "Add cohort"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 rounded-md px-2.5 py-2 text-sm text-gray-500 transition-colors hover:bg-mist/60"
        >
          Cancel
        </button>
      </form>
      <ActionFeedback state={state} />
    </div>
  );
}
