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
 * The one way hours reach a student: a grant, with the consultant and task
 * optionally named on it. Hours alone land in the student's unassigned pool
 * until an admin decides who does what; naming a consultant puts them on that
 * consultant's ledger, and naming a task makes it that piece of work's budget.
 *
 * Always ADDS: these hours go on top of whatever the student already holds with
 * this consultant (or unassigned), and a named task is created — or, if one by
 * that name is already open, its budget grows. Correcting a total is the ⋮
 * menu's job on the row itself. Picking a mentor who isn't in the student's
 * program yet assigns them to it as part of the same action.
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
      <h3 className="text-sm font-semibold text-ink">Allocate hours</h3>
      <p className="mt-1 text-xs text-muted-fg">
        The hours go to the student. Name a consultant to put them on their
        ledger, and a task to make these hours its budget — or leave either for
        later and the hours wait, unassigned.
      </p>
      <input type="hidden" name="studentProfileId" value={studentProfileId} />
      <input type="hidden" name="mode" value="add" />

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0">
          <span className={labelClass}>Consultant</span>
          <div className="mt-1">
            <Select
              name="mentorId"
              ariaLabel="Consultant"
              options={mentors}
              placeholder="No one yet — decide later"
              required={false}
              onChange={setMentorId}
            />
          </div>
        </div>

        {/* Remounted per mentor: their open tasks lead the list, and a task
            picked for one mentor must never be left selected under another's.
            The "" key is the unassigned pool's own open tasks. */}
        <TaskPicker
          key={mentorId}
          className="lg:col-span-2"
          optional
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

        <label className="min-w-0 sm:col-span-2 lg:col-span-3">
          <span className={labelClass}>Note</span>
          <Input
            name="taskNote"
            type="text"
            maxLength={500}
            placeholder="Optional — e.g. review the intro of each essay"
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
