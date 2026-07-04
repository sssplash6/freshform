"use client";

import { useActionState } from "react";

import { setAllottedHours } from "@/lib/actions/students";

/** Inline per-student allotment editor (admin only). */
export function SetHoursForm({
  studentProfileId,
  currentHours,
}: {
  studentProfileId: string;
  currentHours: number;
}) {
  const [state, action, pending] = useActionState(setAllottedHours, null);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="studentProfileId" value={studentProfileId} />
      <input
        name="newHours"
        type="number"
        min="0"
        step="any"
        defaultValue={currentHours}
        aria-label="New allotted hours"
        className="w-20 rounded-md border border-mist px-2 py-1 text-sm focus:border-navy focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-navy px-2 py-1 text-xs font-medium text-navy transition-colors hover:bg-navy hover:text-white disabled:opacity-50"
      >
        {pending ? "…" : "Set"}
      </button>
      {state && !state.ok && (
        <span role="alert" className="text-xs text-red-600">
          {state.error}
        </span>
      )}
    </form>
  );
}
