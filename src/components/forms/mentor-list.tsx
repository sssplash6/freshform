"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { ProgramTargetsPicker } from "@/components/forms/program-targets-picker";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateMentor } from "@/lib/actions/mentors";
import { USER_STATUS } from "@/lib/constants";
import type { ProgramOption } from "@/lib/queries";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";

export type MentorListRow = {
  id: string;
  name: string | null;
  email: string;
  status: string;
  isAdmin: boolean;
  assignments: {
    id: string;
    /** "p:<programId>" / "c:<cohortId>" — the checkbox value this pairing maps to. */
    checkedValue: string;
    label: string;
    calendlyUrl: string | null;
  }[];
};

function MentorRow({
  mentor,
  programs,
}: {
  mentor: MentorListRow;
  programs: ProgramOption[];
}) {
  const [state, action] = useActionState(updateMentor, null);
  const [editing, setEditing] = useState(false);

  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-medium text-ink">
            <Link
              href={`/admin/mentors/${mentor.id}`}
              className="hover:text-brand"
            >
              {mentor.name ?? mentor.email}
            </Link>
            {mentor.isAdmin && (
              <StatusChip severity="neutral">Admin · also mentor</StatusChip>
            )}
            {mentor.status === USER_STATUS.UNASSIGNED && (
              <StatusChip severity="attention">Not in any program</StatusChip>
            )}
          </div>
          <div className="text-xs text-muted-fg">{mentor.email}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {mentor.assignments.length === 0 ? (
              <span className="text-xs text-muted-fg">
                No programs assigned yet
              </span>
            ) : (
              mentor.assignments.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1">
                  <StatusChip severity={a.calendlyUrl ? "ok" : "attention"}>
                    {a.label}
                  </StatusChip>
                  {a.calendlyUrl ? (
                    <a
                      href={a.calendlyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand underline decoration-line underline-offset-2 hover:decoration-brand"
                    >
                      link
                    </a>
                  ) : (
                    <span className="text-xs text-muted-fg">no link</span>
                  )}
                </span>
              ))
            )}
          </div>
        </div>
        {!editing && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {editing && (
        <form
          action={action}
          className="rise-in mt-4 border-t border-line pt-4"
          // Remount when assignments change so the checkboxes reflect what
          // was actually saved.
          key={mentor.assignments.map((a) => a.checkedValue).join("|")}
        >
          <input type="hidden" name="mentorId" value={mentor.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input name="name" type="text" required defaultValue={mentor.name ?? ""} />
            </Field>
            <Field label="Email" required>
              <Input
                name="email"
                type="email"
                required
                defaultValue={mentor.email}
              />
            </Field>
          </div>
          <ProgramTargetsPicker
            programs={programs}
            defaultTargets={mentor.assignments.map((a) => a.checkedValue)}
            legend="Programs / cohorts"
            // Unticking everything is a real choice here — it parks the mentor
            // as unassigned — so the group is not required on edit.
            required={false}
          />
          <p className="mt-1.5 text-xs text-muted-fg">
            Unselecting everything parks the mentor as unassigned again.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-3 py-2 text-sm text-muted-fg transition-colors hover:bg-canvas"
            >
              Cancel
            </button>
          </div>
          <ActionFeedback state={state} />
        </form>
      )}
    </li>
  );
}

/** Every mentor with their assignments, each row expandable for edits. */
export function MentorList({
  mentors,
  programs,
}: {
  mentors: MentorListRow[];
  programs: ProgramOption[];
}) {
  if (mentors.length === 0) {
    return (
      <EmptyState title="No mentors registered">
        Staff on the mentor domain are added on their first sign-in.
      </EmptyState>
    );
  }
  return (
    <ul className="space-y-3">
      {mentors.map((m) => (
        <MentorRow key={m.id} mentor={m} programs={programs} />
      ))}
    </ul>
  );
}
