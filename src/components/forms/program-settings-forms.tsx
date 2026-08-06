"use client";

import { useActionState, useState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { Select, type SelectOption } from "@/components/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { assignMentorToProgram } from "@/lib/actions/mentors";
import { deleteCohort, deleteProgram, renameProgram } from "@/lib/actions/programs";
import { deleteStudent } from "@/lib/actions/students";

const labelClass =
  "block text-xs font-semibold uppercase tracking-[0.06em] text-muted-fg";

/** Rename the program. Its name is its identity, so this is a deliberate save. */
export function RenameProgramForm({
  programId,
  currentName,
}: {
  programId: string;
  currentName: string;
}) {
  const [state, action, pending] = useActionState(renameProgram, null);

  return (
    <form action={action}>
      <input type="hidden" name="programId" value={programId} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1">
          <span className={labelClass}>Program name</span>
          <Input
            name="name"
            type="text"
            required
            minLength={3}
            maxLength={80}
            defaultValue={currentName}
            className="mt-1"
          />
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save name"}
        </Button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}

/**
 * Assign a mentor to this program — the same pairing the mentors page edits,
 * reached from the program's side. Program-wide unless a cohort is named.
 */
export function AssignMentorForm({
  programId,
  mentors,
  cohorts,
}: {
  programId: string;
  mentors: SelectOption[];
  cohorts: SelectOption[];
}) {
  const [state, action, pending] = useActionState(assignMentorToProgram, null);

  return (
    <form action={action}>
      <h3 className="text-sm font-semibold text-ink">Assign a mentor</h3>
      <p className="mt-1 text-xs text-muted-fg">
        They can then be given a student&apos;s hours, and set their own booking
        link from their mentor page.
      </p>
      <input type="hidden" name="programId" value={programId} />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-56">
          <span className={labelClass}>Mentor</span>
          <div className="mt-1">
            <Select
              name="mentorId"
              ariaLabel="Mentor"
              options={mentors}
              placeholder="Choose a mentor…"
            />
          </div>
        </div>
        {cohorts.length > 0 && (
          <div className="min-w-44">
            <span className={labelClass}>Cohort</span>
            <div className="mt-1">
              <Select
                name="cohortId"
                ariaLabel="Cohort"
                options={cohorts}
                placeholder="Program-wide"
                required={false}
              />
            </div>
          </div>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Assigning…" : "Assign"}
        </Button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}

/** Two-step inline confirm, the app's one shape for a destructive action. */
function DangerButton({
  action,
  hidden,
  label,
  confirmLabel,
  question,
  pending,
}: {
  action: (formData: FormData) => void;
  hidden: React.ReactNode;
  label: string;
  confirmLabel: string;
  question: React.ReactNode;
  pending: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <form action={action}>
      {hidden}
      {confirming ? (
        <span className="rise-in flex flex-wrap items-center justify-end gap-2 text-xs">
          <span className="text-muted-fg">{question}</span>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-800 disabled:opacity-50"
          >
            {pending ? "Removing…" : confirmLabel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(false)}
            className="rounded-lg px-2.5 py-1.5 text-xs text-muted-fg transition-colors hover:bg-canvas"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
        >
          {label}
        </button>
      )}
    </form>
  );
}

/** Delete an empty cohort. */
export function DeleteCohortButton({
  cohortId,
  cohortName,
}: {
  cohortId: string;
  cohortName: string;
}) {
  const [state, action, pending] = useActionState(deleteCohort, null);

  return (
    <div className="flex flex-col items-end gap-1">
      <DangerButton
        action={action}
        pending={pending}
        hidden={<input type="hidden" name="cohortId" value={cohortId} />}
        label="Delete"
        confirmLabel="Yes, delete"
        question={`Delete ${cohortName}?`}
      />
      <ActionFeedback state={state} />
    </div>
  );
}

/**
 * Remove a student from the program entirely. Blocked once they have logged
 * sessions — at that point the record is part of the hour ledger, not a typo.
 */
export function RemoveStudentButton({
  studentProfileId,
  label,
  hasSessions,
}: {
  studentProfileId: string;
  label: string;
  hasSessions: boolean;
}) {
  const [state, action, pending] = useActionState(deleteStudent, null);

  if (hasSessions) {
    return (
      <span className="text-xs text-muted-fg">
        Has logged sessions — can&apos;t be removed
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <DangerButton
        action={action}
        pending={pending}
        hidden={
          <input type="hidden" name="studentProfileId" value={studentProfileId} />
        }
        label="Remove"
        confirmLabel="Yes, remove"
        question={`Remove ${label} and their allocations?`}
      />
      <ActionFeedback state={state} />
    </div>
  );
}

/** Close the program down, once nothing is left in it. */
export function DeleteProgramButton({
  programId,
  programName,
  blockedReason,
}: {
  programId: string;
  programName: string;
  /** Why it can't go yet, shown in place of the button. */
  blockedReason?: string;
}) {
  const [state, action, pending] = useActionState(deleteProgram, null);

  if (blockedReason) {
    return <p className="text-sm text-muted-fg">{blockedReason}</p>;
  }

  return (
    <div>
      <DangerButton
        action={action}
        pending={pending}
        hidden={<input type="hidden" name="programId" value={programId} />}
        label={`Delete ${programName}`}
        confirmLabel="Yes, delete it"
        question="This removes the program and its empty cohorts."
      />
      <ActionFeedback state={state} />
    </div>
  );
}
