"use client";

import { useActionState } from "react";

import { createStudents } from "@/lib/actions/students";
import { ActionFeedback } from "@/components/forms/action-feedback";
import type { ProgramOption } from "@/lib/queries";

const selectClass =
  "min-h-11 rounded-md border border-mist bg-white px-3.5 py-2.5 text-[15px] text-gray-900 transition hover:border-navy/40 focus:border-navy focus:outline-none";

/**
 * Staff pastes a list of student emails into ONE program (a cohort is only
 * asked for in programs that have them). Each student confirms their name
 * and Telegram username on first sign-in.
 */
export function AddStudentsForm({ program }: { program: ProgramOption }) {
  const [state, action, pending] = useActionState(createStudents, null);

  return (
    <form action={action}>
      <input type="hidden" name="programId" value={program.id} />
      <label className="block text-sm">
        <span className="text-gray-600">
          Add students by email — paste one or many, separated by new lines or
          commas
        </span>
        <textarea
          name="emails"
          required
          rows={2}
          placeholder={"student1@example.com\nstudent2@example.com"}
          className="mt-0.5 w-full rounded-md border border-mist px-3.5 py-2.5 text-[15px] focus:border-navy focus:outline-none"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {program.cohorts.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Cohort *
            <select
              name="cohortId"
              required
              defaultValue={program.cohorts.length === 1 ? program.cohorts[0].id : ""}
              className={selectClass}
            >
              <option value="" disabled>
                Select…
              </option>
              {program.cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
        >
          {pending ? "Adding…" : `Add to ${program.name}`}
        </button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
