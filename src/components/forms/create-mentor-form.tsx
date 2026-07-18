"use client";

import { useActionState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { Select } from "@/components/select";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createMentor } from "@/lib/actions/mentors";
import type { ProgramOption } from "@/lib/queries";

/**
 * Admin registers a mentor directly: email, full name, and the program (or
 * cohort) they work in. The mentor signs in with Google afterwards and sets
 * their own booking link — no self-signup step needed.
 */
export function CreateMentorForm({ programs }: { programs: ProgramOption[] }) {
  const [state, action, pending] = useActionState(createMentor, null);

  const targets = programs.flatMap((p) => [
    {
      value: `p:${p.id}`,
      label: p.cohorts.length > 0 ? `${p.name} (all cohorts)` : p.name,
    },
    ...p.cohorts.map((c) => ({
      value: `c:${c.id}`,
      label: `${p.name} / ${c.name}`,
    })),
  ]);

  return (
    <form action={action} className="rounded-lg border border-mist bg-white p-4">
      <h2 className="text-base font-semibold text-navy">Register a mentor</h2>
      <p className="mt-1 text-xs text-gray-500">
        The mentor signs in with this email using Google and sets their own
        booking link from their mentor page.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <Field label="Program / cohort" required>
          <Select name="target" ariaLabel="Program or cohort" options={targets} />
        </Field>
      </div>
      <div className="mt-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Registering…" : "Register mentor"}
        </Button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
