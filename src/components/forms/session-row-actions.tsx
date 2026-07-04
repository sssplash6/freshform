"use client";

import { useActionState } from "react";

import { editSession, voidSession } from "@/lib/actions/sessions";
import { ActionFeedback } from "@/components/forms/action-feedback";

const inputClass =
  "rounded-md border border-mist px-2 py-1 text-sm focus:border-navy focus:outline-none";

/** Edit + void controls for one ACTIVE session the mentor logged. */
export function SessionRowActions({
  session,
}: {
  session: { id: string; hours: number; date: string; note: string | null };
}) {
  const [editState, editAction, editPending] = useActionState(
    editSession,
    null
  );
  const [voidState, voidAction, voidPending] = useActionState(
    voidSession,
    null
  );

  return (
    <details className="text-sm">
      <summary className="cursor-pointer select-none text-navy hover:underline">
        Correct
      </summary>
      <div className="mt-2 space-y-3 rounded-md border border-mist bg-mist/20 p-3">
        <form action={editAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="sessionId" value={session.id} />
          <label className="block text-xs text-gray-600">
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
          <label className="block text-xs text-gray-600">
            Date
            <input
              name="date"
              type="date"
              required
              defaultValue={session.date}
              className={`${inputClass} block`}
            />
          </label>
          <label className="block flex-1 text-xs text-gray-600">
            Note
            <input
              name="note"
              type="text"
              defaultValue={session.note ?? ""}
              className={`${inputClass} block w-full`}
            />
          </label>
          <button
            type="submit"
            disabled={editPending}
            className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
          >
            {editPending ? "Saving…" : "Save changes"}
          </button>
        </form>
        <ActionFeedback state={editState} />

        <form
          action={voidAction}
          onSubmit={(e) => {
            if (
              !confirm(
                "Void this session? The hours return to the student's balance."
              )
            )
              e.preventDefault();
          }}
        >
          <input type="hidden" name="sessionId" value={session.id} />
          <button
            type="submit"
            disabled={voidPending}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {voidPending ? "Voiding…" : "Void session"}
          </button>
        </form>
        <ActionFeedback state={voidState} />
      </div>
    </details>
  );
}
