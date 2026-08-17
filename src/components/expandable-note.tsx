"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Note text clamped to a few lines: some notes run to paragraphs, and one of
 * them turning a row forty lines tall costs every other row its scanability.
 * A "Show more" toggle unfolds the full note in place, and only appears when
 * the clamp actually cut something off.
 */
export function ExpandableNote({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);

  // Measured while clamped — an open note never overflows its own height.
  useLayoutEffect(() => {
    if (!open && ref.current) {
      setClipped(ref.current.scrollHeight > ref.current.clientHeight + 1);
    }
  }, [open, text]);

  return (
    <div>
      <div
        ref={ref}
        className={`whitespace-pre-line text-ink ${open ? "" : "line-clamp-3"}`}
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
