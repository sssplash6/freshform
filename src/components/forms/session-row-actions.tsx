"use client";

import { useActionState, useState } from "react";

import { editSession, voidSession } from "@/lib/actions/sessions";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { ChevronDownIcon } from "@/components/icons";

const inputClass =
  "rounded-lg border border-line px-2 py-1 text-sm focus:border-brand focus:outline-none";

/** Edit + void controls for one ACTIVE session the mentor logged. Voiding
 * confirms inline (no browser dialog). */
export function SessionRowActions({
  session,
  goals = [],
}: {
  session: {
    id: string;
    hours: number;
    date: string;
    attended: boolean;
    task: string | null;
    note: string | null;
    assignmentId: string | null;
  };
  /** The mentor's goals for this session's student, so a mis-pick is fixable. */
  goals?: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [confirmingVoid, setConfirmingVoid] = useState(false);
  const [editState, editAction, editPending] = useActionState(
    editSession,
    null
  );
  const [voidState, voidAction, voidPending] = useActionState(
    voidSession,
    null
  );

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 font-medium text-ink transition-colors hover:text-accent-ink"
      >
        Correct
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="rise-in mt-2 space-y-3 rounded-lg border border-line bg-canvas p-3">
          <form action={editAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="sessionId" value={session.id} />
            {goals.length > 0 && (
              <label className="block text-xs text-muted-fg">
                Goal
                <select
                  name="assignmentId"
                  defaultValue={session.assignmentId ?? ""}
                  className={`${inputClass} block max-w-56`}
                >
                  {/* Blank keeps whatever the session already has, so correcting
                      the hours never forces a goal onto older history. */}
                  <option value="">Leave unchanged</option>
                  {goals.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-xs text-muted-fg">
              Hours
              <input
                name="hours"
                type="number"
                min="0.01"
                step="any"
                required
                defaultValue={session.hours}
                className={`${inputClass} block w-20`}
              />
            </label>
            <label className="block text-xs text-muted-fg">
              Date
              <input
                name="date"
                type="date"
                required
                defaultValue={session.date}
                className={`${inputClass} block`}
              />
            </label>
            <label className="block flex-1 text-xs text-muted-fg">
              Task focused on
              <input
                name="task"
                type="text"
                defaultValue={session.task ?? ""}
                className={`${inputClass} block w-full`}
              />
            </label>
            <label className="block flex-1 text-xs text-muted-fg">
              Note
              <input
                name="note"
                type="text"
                defaultValue={session.note ?? ""}
                className={`${inputClass} block w-full`}
              />
            </label>
            <label className="flex w-full items-center gap-2 text-xs text-ink">
              <input
                name="attended"
                type="checkbox"
                value="yes"
                defaultChecked={session.attended}
                className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
              />
              Student was present (uncheck for a no-show)
            </label>
            <button
              type="submit"
              disabled={editPending}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {editPending ? "Saving…" : "Save changes"}
            </button>
          </form>
          <ActionFeedback state={editState} />

          <form action={voidAction}>
            <input type="hidden" name="sessionId" value={session.id} />
            {confirmingVoid ? (
              <span className="rise-in flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-fg">
                  The hours return to the student&apos;s balance.
                </span>
                <button
                  type="submit"
                  disabled={voidPending}
                  className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-800 disabled:opacity-50"
                >
                  {voidPending ? "Voiding…" : "Yes, void it"}
                </button>
                <button
                  type="button"
                  disabled={voidPending}
                  onClick={() => setConfirmingVoid(false)}
                  className="rounded-lg px-2.5 py-1.5 text-xs text-muted-fg transition-colors hover:bg-canvas"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingVoid(true)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
              >
                Void session
              </button>
            )}
          </form>
          <ActionFeedback state={voidState} />
        </div>
      )}
    </div>
  );
}
