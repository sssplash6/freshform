"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { MoreVerticalIcon } from "@/components/icons";
import { Select, type SelectOption } from "@/components/select";
import { Button } from "@/components/ui/button";
import { useAnchoredPosition } from "@/lib/use-anchored-position";
import {
  deleteAssignment,
  setAssignmentProgress,
  updateAssignment,
} from "@/lib/actions/assignments";
import {
  ASSIGNMENT_PROGRESS,
  ASSIGNMENT_PROGRESS_AUTO,
  ASSIGNMENT_PROGRESS_LABELS,
} from "@/lib/constants";

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none";

const labelClass = "block text-xs font-medium text-muted-fg";

const PROGRESS_ORDER = [
  ASSIGNMENT_PROGRESS.NOT_STARTED,
  ASSIGNMENT_PROGRESS.IN_PROGRESS,
  ASSIGNMENT_PROGRESS.DONE,
];

type AssignmentFields = {
  id: string;
  purpose: string;
  mentorId: string;
  hourLimit: number | null;
  timeline: string | null;
  progress: string;
  /** True when an admin pinned the progress, so hours no longer move it. */
  progressManual: boolean;
};

/**
 * Per-row assignment controls behind a ⋮ menu: move it through its progress
 * states in one click, edit any field, or remove the row. Progress leads
 * because it is the thing that actually changes week to week — opening a whole
 * form to tick something off would be the wrong shape for it.
 *
 * Portaled to <body> and positioned fixed for the same reason as the allocation
 * menu: the table scrolls horizontally and would otherwise clip it. See
 * lib/use-anchored-position.ts.
 */
export function AssignmentRowActions({
  assignment,
  mentors,
}: {
  assignment: AssignmentFields;
  mentors: SelectOption[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [progressState, progressAction, progressPending] = useActionState(
    setAssignmentProgress,
    null,
  );
  const [editState, editAction, editPending] = useActionState(updateAssignment, null);
  const [delState, delAction, delPending] = useActionState(deleteAssignment, null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const anchored = useAnchoredPosition(open, triggerRef, menuRef, {
    align: "end",
  });

  const close = () => {
    setOpen(false);
    setEditing(false);
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
        aria-label={`Manage "${assignment.purpose}"`}
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
            className={`pop-in z-50 w-72 rounded-xl border border-line bg-surface p-3 text-left shadow-soft ${
              anchored?.up
                ? "[--pop-origin:bottom_right]"
                : "[--pop-origin:top_right]"
            }`}
          >
            {!editing ? (
              <>
                <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-fg">
                  Progress
                </div>
                <p className="mt-1 text-xs text-muted-fg">
                  {assignment.progressManual
                    ? "Set by hand, so logged hours no longer move it."
                    : "Following the logged hours. Setting it here pins it."}
                </p>
                <form action={progressAction} className="mt-2 flex flex-wrap gap-1.5">
                  <input type="hidden" name="assignmentId" value={assignment.id} />
                  {PROGRESS_ORDER.map((p) => {
                    // "Current" only disables when pinned there: on an automatic
                    // goal, clicking its present state is how you pin it.
                    const current =
                      p === assignment.progress && assignment.progressManual;
                    return (
                      <button
                        key={p}
                        type="submit"
                        name="progress"
                        value={p}
                        disabled={progressPending || current}
                        aria-current={current}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-default ${
                          current
                            ? "bg-brand text-white"
                            : "border border-line text-ink hover:border-brand hover:text-brand disabled:opacity-50"
                        }`}
                      >
                        {ASSIGNMENT_PROGRESS_LABELS[p]}
                      </button>
                    );
                  })}
                  {assignment.progressManual && (
                    <button
                      type="submit"
                      name="progress"
                      value={ASSIGNMENT_PROGRESS_AUTO}
                      disabled={progressPending}
                      className="rounded-lg border border-dashed border-line px-2.5 py-1.5 text-xs font-medium text-muted-fg transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
                    >
                      Follow hours
                    </button>
                  )}
                </form>
                <ActionFeedback state={progressState} />

                <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-xs font-medium text-brand transition-colors hover:underline"
                  >
                    Edit assignment
                  </button>
                  <form action={delAction}>
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    {confirmDelete ? (
                      <span className="flex items-center gap-1.5">
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
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="text-xs font-medium text-red-700 transition-colors hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </form>
                </div>
                <ActionFeedback state={delState} />
              </>
            ) : (
              <>
                <form action={editAction} className="space-y-2.5">
                  <input type="hidden" name="assignmentId" value={assignment.id} />
                  <input type="hidden" name="progress" value={assignment.progress} />
                  <label className={labelClass}>
                    Purpose
                    <input
                      name="purpose"
                      type="text"
                      required
                      maxLength={200}
                      defaultValue={assignment.purpose}
                      className={inputClass}
                    />
                  </label>
                  <div className={labelClass}>
                    Consultant
                    <div className="mt-1">
                      <Select
                        name="mentorId"
                        ariaLabel="Consultant"
                        options={mentors}
                        defaultValue={assignment.mentorId}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <label className={`${labelClass} flex-1`}>
                      Hour limit
                      <input
                        name="hourLimit"
                        type="number"
                        min="0"
                        step="any"
                        defaultValue={assignment.hourLimit ?? ""}
                        className={inputClass}
                      />
                    </label>
                    <label className={`${labelClass} flex-1`}>
                      Timeline
                      <input
                        name="timeline"
                        type="text"
                        maxLength={60}
                        placeholder="Aug 7"
                        defaultValue={assignment.timeline ?? ""}
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={editPending}>
                      {editPending ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
                <ActionFeedback state={editState} />
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
