"use client";

import { useActionState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { Select, type SelectOption } from "@/components/select";
import { Button } from "@/components/ui/button";
import { setMentorAllocation } from "@/lib/actions/students";

const inputClass =
  "mt-1 rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none";

/**
 * Add another mentor to a student: pick any mentor, allocate hours with a
 * deadline (and amount paid for Master's). Picking a mentor who isn't in the
 * student's program yet assigns them to it as part of the same action.
 */
export function AddMentorForm({
  studentProfileId,
  mentors,
  showAmountPaid = false,
}: {
  studentProfileId: string;
  mentors: SelectOption[];
  showAmountPaid?: boolean;
}) {
  const [state, action, pending] = useActionState(setMentorAllocation, null);

  return (
    <form action={action} className="rounded-xl border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold text-ink">Add a mentor</h3>
      <p className="mt-1 text-xs text-muted-fg">
        Grants the student hours from another mentor — and adds that mentor to
        this program if they aren&apos;t in it yet.
      </p>
      <input type="hidden" name="studentProfileId" value={studentProfileId} />
      <input type="hidden" name="mode" value="set" />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="text-xs font-medium text-muted-fg">
          Mentor
          <div className="mt-1 w-56">
            <Select
              name="mentorId"
              ariaLabel="Mentor"
              options={mentors}
              placeholder="Choose a mentor…"
            />
          </div>
        </div>
        <label className="text-xs font-medium text-muted-fg">
          Hours
          <input
            name="hours"
            type="number"
            min="0"
            step="any"
            required
            placeholder="5"
            className={`${inputClass} block w-24`}
          />
        </label>
        <label className="text-xs font-medium text-muted-fg">
          Use by
          <input name="deadline" type="date" required className={`${inputClass} block`} />
        </label>
        {showAmountPaid && (
          <label className="text-xs font-medium text-muted-fg">
            Amount paid ($)
            <input
              name="amountPaid"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="1200"
              className={`${inputClass} block w-28`}
            />
          </label>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add mentor"}
        </Button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
