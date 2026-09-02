"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Only the clamps the callers use; Tailwind can't see a computed class name. */
const CLAMP: Record<number, string> = {
  2: "line-clamp-2",
  3: "line-clamp-3",
};

/**
 * Free text clamped to a few lines: notes run to paragraphs, and so does the
 * occasional task whose name was written as a description. Either one turning a
 * row forty lines tall costs every other row its scanability. A "Show more"
 * toggle unfolds the full text in place, and only appears when the clamp
 * actually cut something off.
 */
export function ExpandableText({
  text,
  lines = 3,
  className = "text-ink",
}: {
  text: string;
  /** How many lines survive the clamp — 2 in a narrow column, 3 in prose. */
  lines?: 2 | 3;
  /** The tone the text carries in its own column. */
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);

  // Measured while clamped — an open text never overflows its own height.
  useLayoutEffect(() => {
    if (!open && ref.current) {
      setClipped(ref.current.scrollHeight > ref.current.clientHeight + 1);
    }
  }, [open, text]);

  return (
    <div>
      <div
        ref={ref}
        className={`whitespace-pre-line ${className} ${open ? "" : CLAMP[lines]}`}
      >
        {text}
      </div>
      {(clipped || open) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-xs font-medium text-brand hover:underline"
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
