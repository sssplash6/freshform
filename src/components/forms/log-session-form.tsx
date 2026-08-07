"use client";

import { useActionState, useState } from "react";

import { logSession } from "@/lib/actions/sessions";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { AttendancePicker } from "@/components/forms/attendance-picker";
import { Select } from "@/components/select";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-lg border border-line px-3.5 py-2.5 text-[15px] focus:border-brand focus:outline-none";

export type LogSessionStudent = {
  profileId: string;
  label: string;
  /** The mentor's own open tasks for this student, in the admin's order. */
  goals: { value: string; label: string }[];
};

/**
 * Log a completed session. Naming the task it went toward is what lets planned
 * hours be read against delivered ones, but it is optional: a meeting that fits
 * none of the tasks still happened, and waiting on an admin to invent one would
 * mean the hours go unlogged. Tasks belong to a student, so the list is
 * re-scoped whenever the student changes, and both selects are keyed to that
 * student so a stale task can't be left selected underneath a new one.
 */
export function LogSessionForm({
  students,
}: {
  students: LogSessionStudent[];
}) {
  const [state, action, pending] = useActionState(logSession, null);
  const [studentId, setStudentId] = useState(
    students.length === 1 ? students[0].profileId : "",
  );
  const today = new Date().toISOString().slice(0, 10);

  const student = students.find((s) => s.profileId === studentId);
  const goals = student?.goals ?? [];
  const noGoals = Boolean(student) && goals.length === 0;

  return (
    <form
      action={action}
      className="rounded-xl border border-line bg-surface p-4"
    >
      <h2 className="text-base font-semibold text-ink">
        Log a completed session
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="block text-sm">
          <span className="text-muted-fg">Student *</span>
          <div className="mt-0.5">
            <Select
              name="studentProfileId"
              ariaLabel="Student"
              defaultValue={studentId}
              onChange={setStudentId}
              options={students.map((s) => ({
                value: s.profileId,
                label: s.label,
              }))}
            />
          </div>
        </div>
        <div className="block text-sm">
          <span className="text-muted-fg">Task worked on</span>
          <div className="mt-0.5">
            <Select
              // Remount per student so the previous student's goal is never
              // left selected behind the new student's list.
              key={studentId}
              name="assignmentId"
              ariaLabel="Task worked on"
              options={goals}
              required={false}
              placeholder={
                !student
                  ? "Pick a student first…"
                  : noGoals
                    ? "No tasks assigned yet"
                    : "Optional — choose a task…"
              }
            />
          </div>
        </div>
        <label className="block text-sm">
          <span className="text-muted-fg">Hours *</span>
          <input
            name="hours"
            type="number"
            min="0.01"
            step="any"
            required
            placeholder="1.5"
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-fg">Date *</span>
          <input
            name="date"
            type="date"
            required
            defaultValue={today}
            max={today}
            className={inputClass}
          />
        </label>
        <label className="block text-sm sm:col-span-2 lg:col-span-3">
          <span className="text-muted-fg">Notes</span>
          <input
            name="note"
            type="text"
            placeholder="Optional — what you covered, and what's next"
            className={inputClass}
          />
        </label>
      </div>

      {noGoals && (
        <p className="mt-3 text-xs text-muted-fg">
          No tasks assigned to you for this student yet — log the session
          anyway, and it can be attached to a task later with “Correct”.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <AttendancePicker />
        <Button type="submit" disabled={pending} className="h-11 min-w-40">
          {pending ? "Logging…" : "Log session"}
        </Button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
