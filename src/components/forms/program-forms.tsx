"use client";

import { useActionState, useState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { createCohort, createProgram } from "@/lib/actions/programs";

/** Inline "open a new program" control on the admin dashboard. */
export function CreateProgramForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createProgram, null);

  if (!open) {
    return (
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          New program
        </Button>
        <ActionFeedback state={state} />
      </div>
    );
  }

  return (
    <div>
      <form action={action} className="rise-in flex flex-wrap items-center gap-2">
        <div className="w-56">
          <Input
            name="name"
            type="text"
            required
            autoFocus
            placeholder="Program name"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create program"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
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
        <div className="w-56">
          <Input
            name="name"
            type="text"
            required
            autoFocus
            placeholder="e.g. Cohort 1"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add cohort"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </form>
      <ActionFeedback state={state} />
    </div>
  );
}
