"use client";

import { useActionState, useState } from "react";

import { logSession } from "@/lib/actions/sessions";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { Select } from "@/components/select";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-lg border border-line px-3.5 py-2.5 text-[15px] focus:border-brand focus:outline-none";

export type LogSessionStudent = {
  profileId: string;
  label: string;
  /** The mentor's own assigned goals for this student, in the admin's order. */
  goals: { value: string; label: string }[];
};

/**
 * Log a completed session. A goal is required: the mentor says which assigned
 * piece of work the meeting went toward, which is what lets planned hours be
 * read against delivered ones. Goals belong to a student, so the list is
 * re-scoped whenever the student changes, and both selects are keyed to that
 * student so a stale goal can't be left selected underneath a new one.
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
          <span className="text-muted-fg">Goal worked on *</span>
          <div className="mt-0.5">
            <Select
              // Remount per student so the previous student's goal is never
              // left selected behind the new student's list.
              key={studentId}
              name="assignmentId"
              ariaLabel="Goal worked on"
              options={goals}
              placeholder={
                !student
                  ? "Pick a student first…"
                  : noGoals
                    ? "No goals assigned yet"
                    : "Choose a goal…"
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
        <label className="block text-sm">
          <span className="text-muted-fg">Task focused on</span>
          <input
            name="task"
            type="text"
            placeholder="Optional — e.g. personal statement draft"
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-fg">Note</span>
          <input
            name="note"
            type="text"
            placeholder="Optional"
            className={inputClass}
          />
        </label>
      </div>

      {noGoals && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          An admin hasn&apos;t assigned you any goals for this student yet, so
          there is nothing to log against. Ask them to add one on the student&apos;s
          page.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <label className="flex items-start gap-2.5 text-sm">
          <input
            name="attended"
            type="checkbox"
            defaultChecked
            value="yes"
            className="mt-0.5 h-4 w-4 rounded border-line text-brand focus:ring-brand"
          />
          <span>
            <span className="font-medium text-ink">Student was present</span>
            <span className="block text-xs text-muted-fg">
              Uncheck for a no-show. The hours are still deducted, but recorded
              as missed.
            </span>
          </span>
        </label>
        <Button
          type="submit"
          disabled={pending || noGoals}
          className="h-11 min-w-40"
        >
          {pending ? "Logging…" : "Log session"}
        </Button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
