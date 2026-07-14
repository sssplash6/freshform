"use client";

import { useActionState } from "react";

import { assignMentor } from "@/lib/actions/mentors";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { Select } from "@/components/select";
import type { ProgramOption } from "@/lib/queries";

/**
 * Assign a mentor to a whole program, or to one cohort in programs that
 * have them (Global Admissions). Target values are "p:<programId>" /
 * "c:<cohortId>".
 */
export function AssignMentorForm({
  mentors,
  programs,
}: {
  mentors: { id: string; label: string }[];
  programs: ProgramOption[];
}) {
  const [state, action, pending] = useActionState(assignMentor, null);

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
      <h2 className="text-base font-semibold text-navy">
        Assign a mentor to a program
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        The mentor sets their own booking link for each program they&apos;re
        assigned to, from their mentor page.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="block text-sm">
          <span className="text-gray-600">Mentor *</span>
          <div className="mt-0.5">
            <Select
              name="mentorId"
              ariaLabel="Mentor"
              options={mentors.map((m) => ({ value: m.id, label: m.label }))}
            />
          </div>
        </div>
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
      </div>
      <div className="mt-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
        >
          {pending ? "Assigning…" : "Assign mentor"}
        </button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
