"use client";

import { useActionState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createMentor } from "@/lib/actions/mentors";
import type { ProgramOption } from "@/lib/queries";

/** The assignment targets a program + its cohorts offer, as checkbox rows. */
export function targetOptions(programs: ProgramOption[]) {
  return programs.flatMap((p) => [
    {
      value: `p:${p.id}`,
      label: p.cohorts.length > 0 ? `${p.name} (all cohorts)` : p.name,
    },
    ...p.cohorts.map((c) => ({
      value: `c:${c.id}`,
      label: `${p.name} / ${c.name}`,
    })),
  ]);
}

/**
 * Admin registers a mentor directly: email, full name, and every program
 * (or cohort) they work in. The mentor signs in with Google afterwards and
 * sets their own booking links — no self-signup step needed.
 */
export function CreateMentorForm({ programs }: { programs: ProgramOption[] }) {
  const [state, action, pending] = useActionState(createMentor, null);
  const targets = targetOptions(programs);

  return (
    <form action={action} className="rounded-lg border border-line bg-surface p-4">
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
      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-ink">
          Programs / cohorts <span className="text-accent-ink">*</span>
        </legend>
        <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-2">
          {targets.map((t) => (
            <label
              key={t.value}
              className="flex items-center gap-2 text-sm text-ink"
            >
              <input
                type="checkbox"
                name="targets"
                value={t.value}
                className="h-4 w-4 accent-brand"
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Registering…" : "Register mentor"}
        </Button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
