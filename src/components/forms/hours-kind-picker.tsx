"use client";

import { useState } from "react";

import { HOURS_KIND, HOURS_KIND_META } from "@/lib/constants";
import { cn } from "@/lib/cn";

const ORDER: string[] = [HOURS_KIND.PLAN, HOURS_KIND.EXTRA];

/**
 * Whose hours these are — the student's allocation, or the mentor's own time
 * given on top of it. Asked beside attendance and shaped identically, because
 * they are two halves of one thought: what happened, and what it costs.
 *
 * In-plan leads and is the default: nearly every meeting spends allocated
 * hours, and a mentor who never touches this control should still get the
 * ordinary answer. The chosen option spells out its consequence underneath
 * rather than expecting anyone to remember which one moves a balance.
 */
export function HoursKindPicker({
  defaultValue = HOURS_KIND.PLAN,
  compact = false,
}: {
  defaultValue?: string;
  /** Tighter type, for the correction popover. */
  compact?: boolean;
}) {
  const [value, setValue] = useState(
    defaultValue in HOURS_KIND_META ? defaultValue : HOURS_KIND.PLAN,
  );

  return (
    <fieldset className="min-w-0">
      <legend
        className={cn(
          compact ? "text-xs font-medium text-muted-fg" : "text-sm text-muted-fg",
        )}
      >
        Whose hours? <span className="text-accent-ink">*</span>
      </legend>
      <div className="mt-1 flex flex-wrap gap-1 rounded-xl border border-line bg-canvas p-1">
        {ORDER.map((kind) => {
          const active = value === kind;
          return (
            <label
              key={kind}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center rounded-lg px-3.5 transition-colors focus-within:ring-2 focus-within:ring-brand/40",
                compact ? "min-h-9 text-[13px]" : "min-h-11 text-sm",
                active
                  ? "bg-surface font-semibold text-ink shadow-sm"
                  : "font-medium text-muted-fg hover:text-ink",
              )}
            >
              <input
                type="radio"
                name="hoursKind"
                value={kind}
                checked={active}
                onChange={() => setValue(kind)}
                className="sr-only"
              />
              {HOURS_KIND_META[kind].label}
            </label>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-muted-fg">{HOURS_KIND_META[value].hint}</p>
    </fieldset>
  );
}
