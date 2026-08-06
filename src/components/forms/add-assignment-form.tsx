"use client";

import { useActionState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { TaskPicker } from "@/components/forms/task-picker";
import { Select, type SelectOption } from "@/components/select";
import { Button } from "@/components/ui/button";
import { createAssignment } from "@/lib/actions/assignments";

const inputClass =
  "mt-1 block rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none";

const labelClass = "text-xs font-semibold uppercase tracking-[0.06em] text-muted-fg";

/**
 * Add one task to the plan without granting hours for it — the planning half of
 * the same idea the Allocate hours form covers in one step. Only the task and
 * the consultant are required: an admin often books the work in first and
 * settles the budget and timeline later, and blocking on those would push people
 * back to the spreadsheet.
 */
export function AddAssignmentForm({
  studentProfileId,
  mentors,
}: {
  studentProfileId: string;
  mentors: SelectOption[];
}) {
  const [state, action, pending] = useActionState(createAssignment, null);

  return (
    <form action={action}>
      <h3 className="text-sm font-semibold text-ink">Assign a task</h3>
      <p className="mt-1 text-xs text-muted-fg">
        No hours are granted here — the hour limit is a budget for the work.
        Use Allocate hours to give the mentor time for it.
      </p>
      <input type="hidden" name="studentProfileId" value={studentProfileId} />

      <div className="mt-3 flex flex-wrap items-start gap-3">
        <TaskPicker
          name="purpose"
          customName="purposeCustom"
          className="min-w-56 flex-1"
        />
        <div className={labelClass}>
          Consultant <span className="text-accent-ink">*</span>
          <div className="mt-1 w-52">
            <Select
              name="mentorId"
              ariaLabel="Consultant"
              options={mentors}
              placeholder="Choose…"
            />
          </div>
        </div>
        <label className={labelClass}>
          Hour limit
          <input
            name="hourLimit"
            type="number"
            min="0"
            step="any"
            placeholder="3"
            className={`${inputClass} w-24`}
          />
        </label>
        <label className={labelClass}>
          Timeline
          <input
            name="timeline"
            type="text"
            maxLength={60}
            placeholder="Aug 7"
            className={`${inputClass} w-32`}
          />
        </label>
        <Button type="submit" disabled={pending} className="mt-[22px]">
          {pending ? "Assigning…" : "Assign"}
        </Button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
