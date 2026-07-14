"use client";

import { useActionState, useState } from "react";

import { createStudent } from "@/lib/actions/students";
import { ActionFeedback } from "@/components/forms/action-feedback";
import type { ProgramOption } from "@/lib/queries";

const inputClass =
  "w-full rounded-md border border-mist px-3.5 py-2.5 text-[15px] focus:border-navy focus:outline-none";
const selectClass =
  "min-h-11 w-full rounded-md border border-mist bg-white px-3.5 py-2.5 text-[15px] text-gray-900 transition hover:border-navy/40 focus:border-navy focus:outline-none";

/**
 * Staff registers a student's email into a program; a cohort is only asked
 * for in programs that have them (Global Admissions). The student confirms
 * their name and Telegram username on first sign-in.
 */
export function CreateStudentForm({
  programs,
}: {
  programs: ProgramOption[];
}) {
  const [state, action, pending] = useActionState(createStudent, null);
  const [programId, setProgramId] = useState(
    programs.length === 1 ? programs[0].id : ""
  );
  const cohorts = programs.find((p) => p.id === programId)?.cohorts ?? [];

  return (
    <form
      action={action}
      className="rounded-lg border border-mist bg-white p-4"
    >
      <h2 className="text-base font-semibold text-navy">Add a student</h2>
      <p className="mt-1 text-xs text-gray-500">
        The student signs in with this email, then confirms their name and
        Telegram username.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="text-gray-600">Email *</span>
          <input
            name="email"
            type="email"
            required
            placeholder="student@example.com"
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Name</span>
          <input name="name" type="text" className={inputClass} />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Program *</span>
          <div className="mt-0.5">
            <select
              name="programId"
              required
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className={selectClass}
            >
              <option value="" disabled>
                Select…
              </option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </label>
        {cohorts.length > 0 && (
          <label className="block text-sm">
            <span className="text-gray-600">Cohort *</span>
            <div className="mt-0.5">
              <select
                name="cohortId"
                required
                defaultValue=""
                className={selectClass}
              >
                <option value="" disabled>
                  Select…
                </option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </label>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create student"}
        </button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
