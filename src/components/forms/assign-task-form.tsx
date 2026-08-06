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
 * The one way work reaches a mentor: a task, and the hours to do it in. They are
 * the same act — a task nobody has hours for can't be worked on, and hours that
 * name no task can't be logged against — so there is one form rather than two
 * that each did half of it.
 *
 * Always ADDS: these hours go on top of whatever the student already holds with
 * this mentor, and the task is created — or, if they already have one by that
 * name, its budget grows. Correcting a total is the ⋮ menu's job on the row
 * itself. Picking a mentor who isn't in the student's program yet assigns them
 * to it as part of the same action.
 */
export function AssignTaskForm({
  studentProfileId,
  mentors,
  openTasksByMentor = {},
  showAmountPaid = false,
}: {
  studentProfileId: string;
  /** Every mentor who could take this on. */
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
      <h3 className="text-sm font-semibold text-ink">Assign a task</h3>
      <p className="mt-1 text-xs text-muted-fg">
        The hours are granted to this mentor for this task, and become its
        budget. Every session they log names one of the student&apos;s tasks.
      </p>
      <input type="hidden" name="studentProfileId" value={studentProfileId} />
      <input type="hidden" name="mode" value="add" />

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0">
          <span className={labelClass}>
            Consultant <span className="text-accent-ink">*</span>
          </span>
          <div className="mt-1">
            <Select
              name="mentorId"
              ariaLabel="Consultant"
              options={mentors}
              placeholder="Choose a mentor…"
              onChange={setMentorId}
            />
          </div>
        </div>

        {/* Remounted per mentor: their open tasks lead the list, and a task
            picked for one mentor must never be left selected under another's. */}
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
            placeholder="3"
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
          {pending ? "Assigning…" : "Assign task & hours"}
        </Button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
