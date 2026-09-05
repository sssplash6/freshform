"use client";

import { useId, useState } from "react";

import { Select, type SelectOption } from "@/components/select";
import { ConfirmInline } from "@/components/ui/confirm-inline";
import { Input } from "@/components/ui/field";
import { SaveState, useSaveState } from "@/components/ui/save-state";
import { SettingsRow } from "@/components/ui/settings-row";
import { SubmitButton } from "@/components/ui/submit-button";
import { assignMentorToProgram, removeAssignment } from "@/lib/actions/mentors";
import { deleteCohort, deleteProgram, renameProgram } from "@/lib/actions/programs";
import { deleteStudent } from "@/lib/actions/students";

const labelClass =
  "block text-xs font-semibold uppercase tracking-[0.06em] text-muted-fg";

/** Rename the program — one settings row, saved on its own. */
export function RenameProgramForm({
  programId,
  currentName,
}: {
  programId: string;
  currentName: string;
}) {
  const id = useId();
  const [name, setName] = useState(currentName);
  // No reset needed: the action revalidates, so a saved name arrives back as a
  // new `currentName` and the comparison goes false on its own.
  const [, action, save] = useSaveState(renameProgram, name !== currentName);

  return (
    <SettingsRow
      label="Program name"
      htmlFor={id}
      description="Its name is its identity, so this is a deliberate save."
      control={
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="programId" value={programId} />
          <Input
            id={id}
            name="name"
            type="text"
            required
            minLength={3}
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-w-56 flex-1"
          />
          <SubmitButton pendingText="Saving…">Save name</SubmitButton>
        </form>
      }
      state={<SaveState state={save} />}
    />
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
  const [, action, save] = useSaveState(assignMentorToProgram);

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
        <SubmitButton pendingText="Assigning…">Assign</SubmitButton>
      </div>
      <SaveState state={save} />
    </form>
  );
}

/**
 * Remove a mentor from this program — the pairing `AssignMentorForm` makes,
 * unmade. Only the pairing goes: time already allocated to students belongs to
 * the student and the mentor, not to the program row, so it stays.
 *
 * This was `forms/remove-assignment-button.tsx`, a file for one button, with
 * its own `useActionState` and its own hand-written `<span role="alert">` for
 * the error. `SaveState` says that better and says the other four states too,
 * and the button itself is now the same one the three below use.
 */
export function RemoveMentorButton({
  assignmentId,
}: {
  /** The MentorAssignment row — the pairing, not the mentor. */
  assignmentId: string;
}) {
  const [, action, save] = useSaveState(removeAssignment);

  return (
    <div className="flex flex-col items-end gap-1">
      <ConfirmInline
        action={action}
        values={{ assignmentId }}
        pending={save.kind === "saving"}
        label="Remove"
        question="They leave this program. Hours already allocated to students stay."
        confirmLabel="Yes, remove"
        pendingLabel="Removing…"
      />
      <SaveState state={save} />
    </div>
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
  const [, action, save] = useSaveState(deleteCohort);

  return (
    <div className="flex flex-col items-end gap-1">
      <ConfirmInline
        action={action}
        values={{ cohortId }}
        pending={save.kind === "saving"}
        // Named, because the row it sits in is one of several and a bare
        // "Delete" announces nothing about which.
        label={`Delete ${cohortName}`}
        question="Nobody is in it, so nothing moves."
        confirmLabel="Yes, delete"
        pendingLabel="Deleting…"
      />
      <SaveState state={save} />
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
  const [, action, save] = useSaveState(deleteStudent);

  return (
    <div className="flex flex-col items-end gap-1">
      <ConfirmInline
        action={action}
        values={{ studentProfileId }}
        pending={save.kind === "saving"}
        label={`Remove ${label}`}
        // The same sentence the student's own Corrections panel uses for the
        // same action, so a reader who has met one recognises the other.
        question="Removes the account, enrollment, and any allocations. This can't be undone."
        confirmLabel="Yes, remove"
        pendingLabel="Removing…"
        // Disabled rather than absent: a row with no control at all reads as an
        // oversight, and the reason is the interesting part.
        disabledReason={
          hasSessions ? "Has logged sessions — part of the ledger now." : undefined
        }
      />
      <SaveState state={save} />
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
  /** Why it can't go yet, shown beside the disabled button. */
  blockedReason?: string;
}) {
  const [, action, save] = useSaveState(deleteProgram);

  return (
    <div>
      <ConfirmInline
        action={action}
        values={{ programId }}
        pending={save.kind === "saving"}
        label={`Delete ${programName}`}
        question="This removes the program and its empty cohorts."
        confirmLabel="Yes, delete it"
        pendingLabel="Deleting…"
        disabledReason={blockedReason}
      />
      <SaveState state={save} />
    </div>
  );
}
