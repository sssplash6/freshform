"use client";

import { useActionState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { ProgramTargetsPicker } from "@/components/forms/program-targets-picker";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createMentor } from "@/lib/actions/mentors";
import type { ProgramOption } from "@/lib/queries";

/**
 * Admin registers a mentor directly: email, full name, and every program
 * (or cohort) they work in. The mentor signs in with Google afterwards and
 * sets their own booking links — no self-signup step needed.
 */
export function CreateMentorForm({ programs }: { programs: ProgramOption[] }) {
  const [state, action] = useActionState(createMentor, null);

  return (
    <form action={action} className="rounded-xl border border-line bg-surface p-4">
      <h2 className="text-base font-semibold text-ink">Register a mentor</h2>
      <p className="mt-1 text-xs text-muted-fg">
        The mentor signs in with this email using Google and sets their own
        booking link for each program from their mentor page.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Email" required>
          <Input
            name="email"
            type="email"
            required
            placeholder="mentor@example.com"
          />
        </Field>
        <Field label="Full name" required>
          <Input name="name" type="text" required />
        </Field>
      </div>
      <ProgramTargetsPicker programs={programs} legend="Programs / cohorts" />
      <div className="mt-3 flex justify-end">
        <SubmitButton pendingText="Registering…">Register mentor</SubmitButton>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
