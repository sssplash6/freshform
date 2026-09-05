"use client";

import { useState } from "react";

import {
  deleteStudent,
  moveStudent,
  setStudentEmail,
  setStudentFolder,
} from "@/lib/actions/students";
import { ConfirmInline } from "@/components/ui/confirm-inline";
import { Field, Input } from "@/components/ui/field";
import { RowActionGroup, RowActionMenu } from "@/components/ui/row-action-menu";
import { SaveState, useSaveState } from "@/components/ui/save-state";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ProgramOption } from "@/lib/queries";

/**
 * The three facts about a student that only staff may correct, each as a
 * "Change" beside the fact itself rather than a panel of its own.
 *
 * They were three stacked panels — Corrections, Folder, and a Callout — which
 * put the rarest controls on the page in the same visual weight as the ledger
 * everybody opens it for. A fact and the way to change it belong on one line;
 * `FactList` gives them one, and each control is a menu so an accidental tap
 * cannot edit an email address.
 */

const selectClass =
  "min-h-11 w-full rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-ink transition hover:border-brand/40 focus:border-brand focus:outline-none";

/**
 * The address they sign in with. Students brought over from the tracking sheet
 * start with a placeholder and cannot sign in at all until it is their real
 * one, which is why this is not a rare edit in practice.
 */
export function StudentEmailChange({
  studentProfileId,
  currentEmail,
}: {
  studentProfileId: string;
  currentEmail: string;
}) {
  const [, action, save] = useSaveState(setStudentEmail);
  return (
    <RowActionMenu trigger="pencil" label="Change sign-in email" verb="Change">
      <RowActionGroup label="Sign-in email">
        <form action={action} className="space-y-2">
          <input type="hidden" name="studentProfileId" value={studentProfileId} />
          <Field label="Email">
            <Input
              name="email"
              type="email"
              required
              defaultValue={currentEmail}
            />
          </Field>
          <SubmitButton size="sm">Save email</SubmitButton>
          <SaveState state={save} />
        </form>
      </RowActionGroup>
    </RowActionMenu>
  );
}

/**
 * Moving a student takes their hours and their history with them: the rows
 * point at the student, not at the program. What changes is who administers
 * them and which lists they appear on.
 */
export function StudentProgramChange({
  studentProfileId,
  programs,
  currentProgramId,
  currentCohortId,
}: {
  studentProfileId: string;
  programs: ProgramOption[];
  currentProgramId: string;
  currentCohortId: string | null;
}) {
  const [, action, save] = useSaveState(moveStudent);
  const [programId, setProgramId] = useState(currentProgramId);
  const cohorts = programs.find((p) => p.id === programId)?.cohorts ?? [];

  return (
    <RowActionMenu trigger="pencil" label="Move to another program" verb="Change">
      <RowActionGroup label="Program">
        <form action={action} className="space-y-2">
          <input type="hidden" name="studentProfileId" value={studentProfileId} />
          <Field label="Program">
            <select
              name="programId"
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className={selectClass}
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          {cohorts.length > 0 && (
            <Field label="Cohort">
              <select
                name="cohortId"
                defaultValue={currentCohortId ?? ""}
                className={selectClass}
              >
                <option value="">No cohort</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <SubmitButton size="sm">Move student</SubmitButton>
          <SaveState state={save} />
        </form>
      </RowActionGroup>
    </RowActionMenu>
  );
}

/** Where their work lives — a Drive folder, usually — for their mentors. */
export function StudentFolderChange({
  studentProfileId,
  currentFolderUrl,
}: {
  studentProfileId: string;
  currentFolderUrl: string | null;
}) {
  const [, action, save] = useSaveState(setStudentFolder);
  return (
    <RowActionMenu trigger="pencil" label="Change folder link" verb="Change">
      <RowActionGroup label="Folder">
        <form action={action} className="space-y-2">
          <input type="hidden" name="studentProfileId" value={studentProfileId} />
          <Field label="Link" hint="Leave empty to remove it.">
            <Input
              name="folderUrl"
              type="url"
              placeholder="https://drive.google.com/…"
              defaultValue={currentFolderUrl ?? ""}
            />
          </Field>
          <SubmitButton size="sm">Save link</SubmitButton>
          <SaveState state={save} />
        </form>
      </RowActionGroup>
    </RowActionMenu>
  );
}

/**
 * Removing the record entirely. Refused once anything has been logged against
 * them — the sessions are the ledger, and a ledger with a hole in it is worse
 * than a student who left.
 */
export function RemoveStudentButton({
  studentProfileId,
  name,
  hasSessions,
}: {
  studentProfileId: string;
  name: string;
  hasSessions: boolean;
}) {
  const [, action, save] = useSaveState(deleteStudent);
  return (
    <div className="space-y-2">
      <ConfirmInline
        label="Remove student"
        question={`${name}'s record goes, with their tasks and any time granted to them.`}
        confirmLabel="Yes, remove them"
        action={action}
        values={{ studentProfileId }}
        pending={save.kind === "saving"}
        disabledReason={
          hasSessions
            ? "Can't be removed: they have logged sessions."
            : undefined
        }
      />
      <SaveState state={save} />
    </div>
  );
}
