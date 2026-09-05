"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SaveState, useSaveState } from "@/components/ui/save-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { createCohort, createProgram } from "@/lib/actions/programs";

/** Inline "open a new program" control on the admin dashboard. */
export function CreateProgramForm() {
  const [open, setOpen] = useState(false);
  const [, action, save] = useSaveState(createProgram);

  if (!open) {
    return (
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          New program
        </Button>
        <SaveState state={save} />
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
        <SubmitButton pendingText="Creating…">Create program</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </form>
      <SaveState state={save} />
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
  const [, action, save] = useSaveState(createCohort);

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-muted-fg transition-colors hover:text-ink"
        >
          + Add a cohort to this program
        </button>
        <SaveState state={save} />
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
        <SubmitButton pendingText="Adding…">Add cohort</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </form>
      <SaveState state={save} />
    </div>
  );
}
