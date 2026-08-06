"use client";

import { useActionState, useState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { TaskPicker, type OpenTask } from "@/components/forms/task-picker";
import { Select, type SelectOption } from "@/components/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { setMentorAllocation } from "@/lib/actions/students";

const labelClass =
  "block text-xs font-semibold uppercase tracking-[0.06em] text-muted-fg";

/**
 * Grant a student hours from one mentor, for one task. Always ADDS — a grant is
 * new hours on top of whatever the student already holds with that mentor, and
 * correcting a total is the ⋮ menu's job on the row itself.
 *
 * The task is required, and the picker leads with the tasks this mentor already
 * has open for the student so more hours for the same work top that budget up
 * instead of splitting it across two identical rows. Picking a mentor who isn't
 * in the student's program yet assigns them to it as part of the same action.
 */
export function AllocateHoursForm({
  studentProfileId,
  mentors,
  openTasksByMentor = {},
  showAmountPaid = false,
}: {
  studentProfileId: string;
  /** Every mentor, labelled with what the student already holds with them. */
  mentors: SelectOption[];
  /** mentorId → the open tasks they already have with this student. */
  openTasksByMentor?: Record<string, OpenTask[]>;
  showAmountPaid?: boolean;
}) {
  const [state, action, pending] = useActionState(setMentorAllocation, null);
  const [mentorId, setMentorId] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action}>
      <h3 className="text-sm font-semibold text-ink">Allocate hours</h3>
      <p className="mt-1 text-xs text-muted-fg">
        Hours are granted per mentor, for a named task. The mentor logs every
        session against one of the student&apos;s tasks, so say what these hours
        are for.
      </p>
      <input type="hidden" name="studentProfileId" value={studentProfileId} />
      <input type="hidden" name="mode" value="add" />

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0">
          <span className={labelClass}>
            Mentor <span className="text-accent-ink">*</span>
          </span>
          <div className="mt-1">
            <Select
              name="mentorId"
              ariaLabel="Mentor"
              options={mentors}
              placeholder="Choose a mentor…"
              onChange={setMentorId}
            />
          </div>
        </div>

        {/* Remounted per mentor, so a task picked for one mentor can never be
            left selected underneath another's list. */}
        <TaskPicker
          key={mentorId}
          className="lg:col-span-2"
          openTasks={openTasksByMentor[mentorId] ?? []}
          hint={
            (openTasksByMentor[mentorId]?.length ?? 0) > 0
              ? "Picking a task they already have open adds these hours to its budget."
              : undefined
          }
        />

        <label className="min-w-0">
          <span className={labelClass}>
            Hours <span className="text-accent-ink">*</span>
          </span>
          <Input
            name="hours"
            type="number"
            min="0.01"
            step="any"
            required
            placeholder="5"
            className="mt-1"
          />
        </label>

        <label className="min-w-0">
          <span className={labelClass}>
            Use by <span className="text-accent-ink">*</span>
          </span>
          <Input
            name="deadline"
            type="date"
            required
            min={today}
            className="mt-1"
          />
        </label>

        {showAmountPaid && (
          <label className="min-w-0">
            <span className={labelClass}>
              Paid for these hours ($) <span className="text-accent-ink">*</span>
            </span>
            <Input
              name="amountPaid"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="1200"
              className="mt-1"
            />
          </label>
        )}
      </div>

      <div className="mt-3.5">
        <Button type="submit" disabled={pending}>
          {pending ? "Allocating…" : "Allocate hours"}
        </Button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
