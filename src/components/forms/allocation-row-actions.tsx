"use client";

import {
  useActionState,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Fixed viewport coordinates; null until measured (menu stays hidden so it
  // never flashes at a stale position). `up` flips the pop-in origin.
  const [pos, setPos] = useState<{
    right: number;
    top?: number;
    bottom?: number;
    up: boolean;
  } | null>(null);

  const close = () => {
    setOpen(false);
    setConfirmDelete(false);
  };

  // The menu is portaled to <body> and positioned with `fixed` so it escapes
  // the table's `overflow-x-auto` frame, which would otherwise clip it (and
  // force a scrollbar) instead of letting it float above the page.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuH = menuRef.current?.offsetHeight ?? 0;
      const spaceBelow = window.innerHeight - rect.bottom;
      const up = menuH > 0 && spaceBelow < menuH + 12 && rect.top > spaceBelow;
      setPos({
        right: Math.max(8, window.innerWidth - rect.right),
        top: up ? undefined : rect.bottom + 6,
        bottom: up ? window.innerHeight - rect.top + 6 : undefined,
        up,
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

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
        aria-label={`Manage hours with ${mentorLabel}`}
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
              position: "fixed",
              top: pos?.top,
              bottom: pos?.bottom,
              right: pos?.right ?? 8,
              visibility: pos ? "visible" : "hidden",
            }}
            className={`pop-in z-50 w-64 rounded-xl border border-line bg-surface p-3 text-left shadow-soft ${
              pos?.up ? "[--pop-origin:bottom_right]" : "[--pop-origin:top_right]"
            }`}
          >
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
          </div>,
          document.body,
        )}
    </div>
  );
}
