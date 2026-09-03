"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  cancelInterview,
  rescheduleInterview,
} from "@/lib/actions/interviews";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { PencilIcon } from "@/components/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";
import { useAnchoredPosition } from "@/lib/use-anchored-position";

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none";

const labelClass = "block text-xs font-medium text-muted-fg";

/**
 * Move or call off one scheduled meeting — the mentor's own, and only while it
 * is still open. Same shape as the session row's correction menu, because it is
 * the same gesture on the same kind of row.
 *
 * Cancelling confirms inline, like every destructive action in the app: the
 * student has already been told to turn up, so it is not a click to make twice
 * by accident.
 */
export function InterviewRowActions({
  interview,
}: {
  interview: {
    id: string;
    /** YYYY-MM-DD */
    date: string;
    /** HH:MM, or "" when no time was given. */
    time: string;
    link: string | null;
    note: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [editState, editAction] = useActionState(rescheduleInterview, null);
  const [cancelState, cancelAction] = useActionState(cancelInterview, null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const anchored = useAnchoredPosition(open, triggerRef, menuRef, {
    align: "end",
  });

  const close = () => {
    setOpen(false);
    setConfirmingCancel(false);
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
        aria-expanded={open}
        aria-label="Change this meeting"
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
          Change
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
            <form action={editAction} className="space-y-2.5">
              <input type="hidden" name="interviewId" value={interview.id} />
              <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted-fg">
                Move this meeting
              </p>

              <div className="flex gap-2">
                <label className={`${labelClass} flex-1`}>
                  Date
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={interview.date}
                    className={inputClass}
                  />
                </label>
                <label className={`${labelClass} w-28 shrink-0`}>
                  Time
                  <input
                    name="time"
                    type="time"
                    defaultValue={interview.time}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className={labelClass}>
                Link
                <input
                  name="link"
                  type="text"
                  inputMode="url"
                  defaultValue={interview.link ?? ""}
                  placeholder="Meet, Zoom, or where to turn up"
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                Note
                <input
                  name="note"
                  type="text"
                  defaultValue={interview.note ?? ""}
                  placeholder="What it covers"
                  className={inputClass}
                />
              </label>

              <p className="text-xs text-muted-fg">
                A new time asks the student to confirm again.
              </p>

              <SubmitButton size="sm" pendingText="Saving…">
                Save changes
              </SubmitButton>
            </form>
            <ActionFeedback state={editState} />

            <div className="mt-3 border-t border-line pt-2.5">
              <form action={cancelAction}>
                <input type="hidden" name="interviewId" value={interview.id} />
                {confirmingCancel ? (
                  <div className="rise-in flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-fg">
                      The student is told it&apos;s off.
                    </span>
                    <SubmitButton
                      variant="dangerSolid"
                      size="xs"
                      pendingText="Cancelling…"
                    >
                      Yes, cancel it
                    </SubmitButton>
                    <button
                      type="button"
                      onClick={() => setConfirmingCancel(false)}
                      className="rounded-lg px-2 py-1 text-xs text-muted-fg transition-colors hover:bg-canvas"
                    >
                      Keep it
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(true)}
                    className="text-xs font-medium text-danger-ink transition-colors hover:underline"
                  >
                    Cancel this meeting
                  </button>
                )}
              </form>
              <ActionFeedback state={cancelState} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
