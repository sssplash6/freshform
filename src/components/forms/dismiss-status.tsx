"use client";

import { useState } from "react";

import { XIcon } from "@/components/icons";
import { dismissStatus } from "@/lib/actions/dismissals";

/**
 * "Don't show me this again", on one attention row.
 *
 * Two steps, because it is not undoable from the row it removes — once the row
 * is gone there is nothing left to click to bring it back. One tap arms it and
 * names what will happen; the second does it. The same shape as every other
 * destructive control here, at a size that suits a row's right edge.
 *
 * Hidden until the row is hovered or something inside it has focus, so a list
 * of things needing attention does not read as a list of dismiss buttons —
 * except on touch, where there is no hover and it stays visible.
 */
export function DismissStatus({
  type,
  subjectId,
  label,
}: {
  type: string;
  subjectId?: string;
  /** What the row says, so the confirm names the thing being silenced. */
  label: string;
}) {
  const [armed, setArmed] = useState(false);

  if (armed) {
    return (
      <form action={dismissStatus} className="flex items-center gap-1.5">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="subjectId" value={subjectId ?? ""} />
        <span className="text-xs text-muted-fg">Hide for good?</span>
        <button
          type="submit"
          className="min-h-9 cursor-pointer rounded-lg border border-danger px-2.5 text-xs font-semibold text-danger-ink transition-colors hover:bg-danger-soft"
        >
          Hide
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="min-h-9 cursor-pointer rounded-lg px-2 text-xs font-medium text-muted-fg transition-colors hover:text-ink"
        >
          Keep
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      title={`Stop showing "${label}"`}
      aria-label={`Stop showing "${label}"`}
      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-fg opacity-0 transition-opacity hover:bg-canvas hover:text-ink focus-visible:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100"
    >
      <XIcon className="h-4 w-4" />
    </button>
  );
}
