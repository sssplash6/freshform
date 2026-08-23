"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { deleteSession, editSession, voidSession } from "@/lib/actions/sessions";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { AttendancePicker } from "@/components/forms/attendance-picker";
import { PencilIcon } from "@/components/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";
import { useAnchoredPosition } from "@/lib/use-anchored-position";

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none";

const labelClass = "block text-xs font-medium text-muted-fg";

/**
 * Correct, void or remove one logged session. A mentor gets this on their own
 * rows; an admin gets it on every row, plus Delete.
 *
 * Void and delete are different tools on purpose. Voiding keeps the row and
 * hands the hours back — the meeting is part of the history even though it
 * didn't count. Deleting is for a row that should never have been there: a
 * duplicate the import brought in twice, a meeting logged on the wrong student.
 * Both confirm inline, the way every destructive action in the app does.
 *
 * Portaled to <body> and positioned fixed, like the allocation and task menus:
 * every table this sits in scrolls horizontally, and a panel opened inside one
 * is cut off at its edge.
 */
export function SessionRowActions({
  session,
  goals = [],
  canEdit = true,
  canDelete = false,
}: {
  session: {
    id: string;
    hours: number;
    date: string;
    /** One of the four states in lib/constants.ts ATTENDANCE. */
    attendance: string;
    note: string | null;
    assignmentId: string | null;
  };
  /** The tasks of the mentor who ran this session, so a mis-pick is fixable. */
  goals?: { value: string; label: string }[];
  /** False for a voided row: its hours are already back, so only delete is left. */
  canEdit?: boolean;
  /** Admins only: remove the row outright rather than voiding it. */
  canDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingVoid, setConfirmingVoid] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editState, editAction] = useActionState(editSession, null);
  const [voidState, voidAction] = useActionState(voidSession, null);
  const [delState, delAction] = useActionState(deleteSession, null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const anchored = useAnchoredPosition(open, triggerRef, menuRef, {
    align: "end",
  });

  const close = () => {
    setOpen(false);
    setConfirmingVoid(false);
    setConfirmingDelete(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="flex justify-end">
      {/* A pen, which widens to say what it does on hover or keyboard focus. The
          word is what teaches the icon; once learned, the icon is enough, and a
          column of them is quieter than a column of buttons. */}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-label={canEdit ? "Correct this session" : "Manage this session"}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-[13px] font-medium transition-colors",
          open
            ? "bg-canvas text-accent-ink"
            : "text-muted-fg hover:bg-canvas hover:text-accent-ink",
        )}
      >
        <PencilIcon className="h-4 w-4 shrink-0" />
        <span
          aria-hidden="true"
          className={cn(
            "overflow-hidden transition-all duration-150 ease-out motion-reduce:transition-none",
            open
              ? "max-w-24 opacity-100"
              : "max-w-0 opacity-0 group-hover:max-w-24 group-hover:opacity-100 group-focus-visible:max-w-24 group-focus-visible:opacity-100",
          )}
        >
          {canEdit ? "Correct" : "Manage"}
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              ...anchored?.style,
              visibility: anchored ? "visible" : "hidden",
            }}
            className={`pop-in z-50 w-80 rounded-xl border border-line bg-surface p-3 text-left shadow-soft ${
              anchored?.up
                ? "[--pop-origin:bottom_right]"
                : "[--pop-origin:top_right]"
            }`}
          >
            {!canEdit && (
              <p className="text-xs text-muted-fg">
                This session is voided — its hours already went back, so there is
                nothing left to correct. It can still be removed from the log.
              </p>
            )}

            {canEdit && (
            <>
            <form action={editAction} className="space-y-2.5">
              <input type="hidden" name="sessionId" value={session.id} />
              <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted-fg">
                Correct this session
              </p>

              {goals.length > 0 && (
                <label className={labelClass}>
                  Task
                  <select
                    name="assignmentId"
                    defaultValue={session.assignmentId ?? ""}
                    className={inputClass}
                  >
                    {/* Blank keeps whatever the session already has, so fixing
                        the hours never forces a task onto a row without one. */}
                    <option value="">Leave unchanged</option>
                    {goals.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex gap-2">
                <label className={`${labelClass} w-20 shrink-0`}>
                  Hours
                  <input
                    name="hours"
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    defaultValue={session.hours}
                    className={inputClass}
                  />
                </label>
                <label className={`${labelClass} flex-1`}>
                  Date
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={session.date}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className={labelClass}>
                Notes
                <input
                  name="note"
                  type="text"
                  defaultValue={session.note ?? ""}
                  placeholder="What you covered"
                  className={inputClass}
                />
              </label>

              <AttendancePicker defaultValue={session.attendance} compact />

              <SubmitButton size="sm" pendingText="Saving…">
                Save changes
              </SubmitButton>
            </form>
            <ActionFeedback state={editState} />

            <div className="mt-3 border-t border-line pt-2.5">
              <form action={voidAction}>
                <input type="hidden" name="sessionId" value={session.id} />
                {confirmingVoid ? (
                  <div className="rise-in flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-fg">
                      The hours return to the student&apos;s balance.
                    </span>
                    <SubmitButton
                      variant="dangerSolid"
                      size="xs"
                      pendingText="Voiding…"
                    >
                      Yes, void it
                    </SubmitButton>
                    <button
                      type="button"
                      onClick={() => setConfirmingVoid(false)}
                      className="rounded-lg px-2 py-1 text-xs text-muted-fg transition-colors hover:bg-canvas"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingVoid(true)}
                    className="text-xs font-medium text-red-700 transition-colors hover:underline"
                  >
                    Void session — keeps the row, returns the hours
                  </button>
                )}
              </form>
              <ActionFeedback state={voidState} />
            </div>
            </>
            )}

            {canDelete && (
              <div className={canEdit ? "mt-2.5 border-t border-line pt-2.5" : "mt-2.5"}>
                <form action={delAction}>
                  <input type="hidden" name="sessionId" value={session.id} />
                  {confirmingDelete ? (
                    <div className="rise-in flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-fg">
                        Removes the row entirely. Void it instead if the meeting
                        really happened.
                      </span>
                      <SubmitButton
                        variant="dangerSolid"
                        size="xs"
                        pendingText="Deleting…"
                      >
                        Yes, delete it
                      </SubmitButton>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(false)}
                        className="rounded-lg px-2 py-1 text-xs text-muted-fg transition-colors hover:bg-canvas"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      className="text-xs font-medium text-red-700 transition-colors hover:underline"
                    >
                      Delete this session
                    </button>
                  )}
                </form>
                <ActionFeedback state={delState} />
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
