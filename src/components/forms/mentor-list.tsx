"use client";

import { useActionState, useState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { targetOptions } from "@/components/forms/create-mentor-form";
import { Chip } from "@/components/chip";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { updateMentor } from "@/lib/actions/mentors";
import { USER_STATUS } from "@/lib/constants";
import type { ProgramOption } from "@/lib/queries";

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
  const [state, action, pending] = useActionState(updateMentor, null);
  const [editing, setEditing] = useState(false);
  const targets = targetOptions(programs);
  const checked = new Set(mentor.assignments.map((a) => a.checkedValue));

  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-medium text-ink">
            {mentor.name ?? "—"}
            {mentor.isAdmin && <Chip tone="green">Admin · also mentor</Chip>}
            {mentor.status === USER_STATUS.UNASSIGNED && (
              <Chip tone="amber">Unassigned</Chip>
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
                  <Chip tone={a.calendlyUrl ? "green" : "gray"}>
                    {a.label}
                  </Chip>
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
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-brand px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand hover:text-white"
          >
            Edit
          </button>
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
          <fieldset className="mt-3">
            <legend className="text-sm font-medium text-ink">
              Programs / cohorts
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-2">
              {targets.map((t) => (
                <label
                  key={t.value}
                  className="flex items-center gap-2 text-sm text-ink"
                >
                  <input
                    type="checkbox"
                    name="targets"
                    value={t.value}
                    defaultChecked={checked.has(t.value)}
                    className="h-4 w-4 accent-brand"
                  />
                  {t.label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-fg">
              Unchecking everything parks the mentor as unassigned again.
            </p>
          </fieldset>
          <div className="mt-3 flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
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
      <p className="rounded-xl border border-line bg-surface p-8 text-[15px] text-muted-fg">
        No mentors registered yet.
      </p>
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
