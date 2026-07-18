"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { setMentorAllocation } from "@/lib/actions/students";

/** Inline per-mentor allocation editor for one student (admin only): the
 * hours plus the optional deadline they should be used by. */
export function AllocateHoursForm({
  studentProfileId,
  mentorId,
  currentHours,
  currentDeadline,
}: {
  studentProfileId: string;
  mentorId: string;
  currentHours: number;
  currentDeadline: string | null;
}) {
  const [state, action, pending] = useActionState(setMentorAllocation, null);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="studentProfileId" value={studentProfileId} />
      <input type="hidden" name="mentorId" value={mentorId} />
      <input
        name="hours"
        type="number"
        min="0"
        step="any"
        defaultValue={currentHours}
        aria-label="Allocated hours with this mentor"
        className="min-h-11 w-20 rounded-md border border-mist px-2 py-1 text-sm focus:border-navy focus:outline-none"
      />
      <input
        name="deadline"
        type="date"
        defaultValue={currentDeadline ?? ""}
        aria-label="Deadline to use these hours by (optional)"
        title="Deadline to use these hours by (optional)"
        className="min-h-11 rounded-md border border-mist px-2 py-1 text-sm focus:border-navy focus:outline-none"
      />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "…" : "Set"}
      </Button>
      {state && !state.ok && (
        <span role="alert" className="text-xs text-red-700">
          {state.error}
        </span>
      )}
    </form>
  );
}
