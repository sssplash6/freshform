"use client";

import { useId, useState } from "react";

import { Select, type SelectOption } from "@/components/select";
import { ConfirmInline } from "@/components/ui/confirm-inline";
import { Input } from "@/components/ui/field";
import { SaveState, useSaveState } from "@/components/ui/save-state";
import { SettingsRow } from "@/components/ui/settings-row";
import { SubmitButton } from "@/components/ui/submit-button";
import { assignMentorToProgram, removeAssignment } from "@/lib/actions/mentors";
import {
  archiveProgram,
  deleteCohort,
  deleteProgram,
  renameProgram,
  setProgramTracksPayment,
} from "@/lib/actions/programs";

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
 * Does allocating time here also ask what the student paid?
 *
 * A button that names the change rather than a switch that needs a legend
 * beside it: the row already says what the setting is, so the control only has
 * to say which way it is about to move. One 44px target, one write, and the
 * state it is in now is a sentence rather than a position.
 */
export function TrackPaymentToggle({
  programId,
  tracksPayment,
}: {
  programId: string;
  tracksPayment: boolean;
}) {
  const [, action, save] = useSaveState(setProgramTracksPayment);

  return (
    <SettingsRow
      label="Track amount paid per allocation"
      description={
        tracksPayment
          ? "Allocating time here asks for the amount, and the program's total carries it."
          : "Allocating time here asks for hours only."
      }
      control={
        <form action={action}>
          <input type="hidden" name="programId" value={programId} />
          <input
            type="hidden"
            name="tracksPayment"
            value={tracksPayment ? "off" : "on"}
          />
          <SubmitButton variant="secondary" pendingText="Saving…">
            {tracksPayment ? "Stop asking for amounts" : "Ask for amounts"}
          </SubmitButton>
        </form>
      }
      state={<SaveState state={save} />}
    />
  );
}

/**
 * Archive the program, or put it back.
 *
 * The non-destructive end of the same life-cycle `DeleteProgramButton` sits at,
 * which is why they share a page and a shape. Archiving is what a program that
 * RAN does: deletion is refused while it holds a single student, and a finished
 * cohort's ledger is exactly what nobody wants deleted.
 */
export function ArchiveProgramButton({
  programId,
  programName,
  archived,
}: {
  programId: string;
  programName: string;
  archived: boolean;
}) {
  const [, action, save] = useSaveState(archiveProgram);

  return (
    <div>
      <ConfirmInline
        action={action}
        values={{ programId, restore: archived ? "true" : "false" }}
        pending={save.kind === "saving"}
        label={archived ? `Reopen ${programName}` : `Archive ${programName}`}
        question={
          archived
            ? "It comes back to the pickers and the lists it left."
            : "It leaves the pickers and the lists. Every session and allocation stays where it is."
        }
        confirmLabel={archived ? "Yes, reopen it" : "Yes, archive it"}
        pendingLabel={archived ? "Reopening…" : "Archiving…"}
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
