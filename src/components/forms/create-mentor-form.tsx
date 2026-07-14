"use client";

import { useActionState } from "react";

import { createMentor } from "@/lib/actions/mentors";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { Select } from "@/components/select";
import type { ProgramOption } from "@/lib/queries";

const inputClass =
  "w-full rounded-md border border-mist px-3.5 py-2.5 text-[15px] focus:border-navy focus:outline-none";

/**
 * Admin registers a mentor directly: email, full name, and the program (or
 * cohort) they work in with their Calendly link. The mentor signs in with
 * Google afterwards — no self-signup step needed.
 */
export function CreateMentorForm({
  programs,
}: {
  programs: ProgramOption[];
}) {
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
    <form
      action={action}
      className="rounded-lg border border-mist bg-white p-4"
    >
      <h2 className="text-base font-semibold text-navy">Register a mentor</h2>
      <p className="mt-1 text-xs text-gray-500">
        The mentor signs in with this email using Google — nothing else to set
        up on their side.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="text-gray-600">Email *</span>
          <input
            name="email"
            type="email"
            required
            placeholder="mentor@example.com"
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Full name *</span>
          <input name="name" type="text" required className={inputClass} />
        </label>
        <div className="block text-sm">
          <span className="text-gray-600">Program / cohort *</span>
          <div className="mt-0.5">
            <Select
              name="target"
              ariaLabel="Program or cohort"
              options={targets}
            />
          </div>
        </div>
        <label className="block text-sm">
          <span className="text-gray-600">Calendly URL *</span>
          <input
            name="calendlyUrl"
            type="url"
            required
            placeholder="https://calendly.com/…"
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
          {pending ? "Registering…" : "Register mentor"}
        </button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
