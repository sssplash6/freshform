"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { MoreVerticalIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { removeMentorAllocation, setMentorAllocation } from "@/lib/actions/students";

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none";

/**
 * Per-row allocation actions for one mentor, tucked behind a ⋮ menu: set or
 * add hours (with the required deadline, plus amount paid for Master's), or
 * remove the mentor from the student entirely.
 */
export function AllocationRowActions({
  studentProfileId,
  mentorId,
  mentorLabel,
  currentHours,
  currentDeadline,
  showAmountPaid = false,
  currentAmountPaid = null,
}: {
  studentProfileId: string;
  mentorId: string;
  mentorLabel: string;
  currentHours: number;
  currentDeadline: string | null;
  showAmountPaid?: boolean;
  currentAmountPaid?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [setState, setAction, setPending] = useActionState(setMentorAllocation, null);
  const [delState, delAction, delPending] = useActionState(
    removeMentorAllocation,
    null,
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        type="button"
        aria-label={`Manage hours with ${mentorLabel}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-fg transition-colors hover:bg-canvas hover:text-ink"
      >
        <MoreVerticalIcon className="h-4 w-4" />
      </button>

      {open && (
        <div className="pop-in absolute right-0 top-9 z-20 w-64 rounded-xl border border-line bg-surface p-3 text-left shadow-soft [--pop-origin:top_right]">
          <form action={setAction} className="space-y-2.5">
            <input type="hidden" name="studentProfileId" value={studentProfileId} />
            <input type="hidden" name="mentorId" value={mentorId} />
            <label className="block text-xs font-medium text-muted-fg">
              Hours
              <input
                name="hours"
                type="number"
                min="0"
                step="any"
                defaultValue={currentHours}
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
                Amount paid ($)
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
            <div className="flex gap-2">
              <Button type="submit" name="mode" value="set" size="sm" disabled={setPending}>
                {setPending ? "…" : "Set"}
              </Button>
              <Button
                type="submit"
                name="mode"
                value="add"
                size="sm"
                variant="secondary"
                disabled={setPending}
              >
                Add
              </Button>
            </div>
          </form>
          <ActionFeedback state={setState} />

          <div className="mt-3 border-t border-line pt-2.5">
            <form action={delAction}>
              <input type="hidden" name="studentProfileId" value={studentProfileId} />
              <input type="hidden" name="mentorId" value={mentorId} />
              {confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-fg">Remove this mentor?</span>
                  <button
                    type="submit"
                    disabled={delPending}
                    className="rounded-lg bg-red-700 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-800 disabled:opacity-50"
                  >
                    {delPending ? "…" : "Yes, remove"}
                  </button>
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
                  className="text-xs font-medium text-red-700 transition-colors hover:underline"
                >
                  Remove mentor
                </button>
              )}
            </form>
            <ActionFeedback state={delState} />
          </div>
        </div>
      )}
    </div>
  );
}
