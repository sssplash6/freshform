"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { TaskPicker, type OpenTask } from "@/components/forms/task-picker";
import { MoreVerticalIcon } from "@/components/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import { removeMentorAllocation, setMentorAllocation } from "@/lib/actions/students";
import { useAnchoredPosition } from "@/lib/use-anchored-position";

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none";

/**
 * Per-row allocation actions for one mentor — or for the unassigned pool, which
 * rides the same row shape with an empty mentorId — tucked behind a ⋮ menu:
 * correct the total hours, the use-by date and (for Master's) the amount paid,
 * or remove the allocation from the student entirely.
 *
 * A correction that raises the total is still a grant, so the task picker
 * appears the moment the typed hours go above what the student already holds.
 */
export function AllocationRowActions({
  studentProfileId,
  mentorId,
  mentorLabel,
  currentMinutes,
  currentDeadline,
  openTasks = [],
  showAmountPaid = false,
  currentAmountPaid = null,
}: {
  studentProfileId: string;
  mentorId: string;
  mentorLabel: string;
  currentMinutes: number;
  currentDeadline: string | null;
  /** This mentor's open tasks with the student, for a raise that grants hours. */
  openTasks?: OpenTask[];
  showAmountPaid?: boolean;
  currentAmountPaid?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [minutes, setMinutes] = useState(String(currentMinutes));
  // A raise grants hours, and hours arriving name the work they are for.
  const granting = Number(minutes) > currentMinutes;
  const [setState, setAction] = useActionState(setMentorAllocation, null);
  const [delState, delAction] = useActionState(
    removeMentorAllocation,
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Portaled to <body> and positioned `fixed` so it escapes the table's
  // `overflow-x-auto` frame, which would otherwise clip it (and force a
  // scrollbar) instead of letting it float above the page. Null until measured,
  // so it never flashes at a stale position.
  const anchored = useAnchoredPosition(open, triggerRef, menuRef, {
    align: "end",
  });

  const close = () => {
    setOpen(false);
    setConfirmDelete(false);
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
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Manage time with ${mentorLabel}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-fg transition-colors hover:bg-canvas hover:text-ink"
      >
        <MoreVerticalIcon className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              ...anchored?.style,
              visibility: anchored ? "visible" : "hidden",
            }}
            className={`pop-in z-50 w-64 rounded-xl border border-line bg-surface p-3 text-left shadow-soft ${
              anchored?.up
                ? "[--pop-origin:bottom_right]"
                : "[--pop-origin:top_right]"
            }`}
          >
          <form action={setAction} className="space-y-2.5">
            <input type="hidden" name="studentProfileId" value={studentProfileId} />
            <input type="hidden" name="mentorId" value={mentorId} />
            <input type="hidden" name="mode" value="set" />
            <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted-fg">
              Correct this allocation
            </p>
            <label className="block text-xs font-medium text-muted-fg">
              Total minutes
              <input
                name="minutes"
                type="number"
                min="0"
                step="1"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-xs font-medium text-muted-fg">
              Use by
              <input
                name="deadline"
                type="date"
                required
                defaultValue={currentDeadline ?? ""}
                className={inputClass}
              />
            </label>
            {showAmountPaid && (
              <label className="block text-xs font-medium text-muted-fg">
                Total paid ($)
                <input
                  name="amountPaid"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={currentAmountPaid ?? ""}
                  className={inputClass}
                />
              </label>
            )}
            {granting && (
              <div className="rise-in">
                <TaskPicker compact optional openTasks={openTasks} />
                <p className="mt-1.5 text-[11px] text-muted-fg">
                  Name a task and these extra hours become its budget.
                </p>
              </div>
            )}
            <SubmitButton size="sm" pendingText="Saving…">
              Save
            </SubmitButton>
          </form>
          <ActionFeedback state={setState} />

          <div className="mt-3 border-t border-line pt-2.5">
            <form action={delAction}>
              <input type="hidden" name="studentProfileId" value={studentProfileId} />
              <input type="hidden" name="mentorId" value={mentorId} />
              {confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-fg">
                    {mentorId ? "Remove this mentor?" : "Remove this time?"}
                  </span>
                  <SubmitButton
                    variant="dangerSolid"
                    size="xs"
                    pendingText="Removing…"
                  >
                    Yes, remove
                  </SubmitButton>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg px-2 py-1 text-xs text-muted-fg transition-colors hover:bg-canvas"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs font-medium text-danger-ink transition-colors hover:underline"
                >
                  {mentorId ? "Remove mentor" : "Remove time"}
                </button>
              )}
            </form>
            <ActionFeedback state={delState} />
          </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
