"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { setMentorAllocation } from "@/lib/actions/students";

/** Inline per-mentor allocation editor for one student (admin only): the
 * hours plus the required deadline they must be used by. */
export function AllocateHoursForm({
  studentProfileId,
  mentorId,
  currentHours,
  currentDeadline,
  showAmountPaid = false,
  currentAmountPaid = null,
}: {
  studentProfileId: string;
  mentorId: string;
  currentHours: number;
  currentDeadline: string | null;
  showAmountPaid?: boolean;
  currentAmountPaid?: number | null;
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
        className="min-h-11 w-20 rounded-lg border border-line px-2 py-1 text-sm focus:border-brand focus:outline-none"
      />
      <input
        name="deadline"
        type="date"
        required
        defaultValue={currentDeadline ?? ""}
        aria-label="Deadline to use these hours by (required)"
        title="Deadline to use these hours by — once it passes, unused hours are forfeited"
        className="min-h-11 rounded-lg border border-line px-2 py-1 text-sm focus:border-brand focus:outline-none"
      />
      {showAmountPaid && (
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-fg">$</span>
          <input
            name="amountPaid"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={currentAmountPaid ?? ""}
            placeholder="Amount paid"
            aria-label="Amount paid for these hours (USD)"
            title="Total amount the student paid for these hours (USD)"
            className="min-h-11 w-28 rounded-lg border border-line px-2 py-1 text-sm focus:border-brand focus:outline-none"
          />
        </div>
      )}
      {/* Only the clicked button's mode reaches the action: Set replaces the
        * allocation, Add tops it up by the entered amount. */}
      <Button
        type="submit"
        name="mode"
        value="add"
        variant="secondary"
        size="sm"
        disabled={pending}
        title="Add these hours on top of the current allocation"
      >
        {pending ? "…" : "Add"}
      </Button>
      <Button
        type="submit"
        name="mode"
        value="set"
        variant="secondary"
        size="sm"
        disabled={pending}
        title="Replace the current allocation with this exact amount"
      >
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
