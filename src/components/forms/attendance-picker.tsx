"use client";

import { useState } from "react";

import { ATTENDANCE, ATTENDANCE_META } from "@/lib/constants";
import { cn } from "@/lib/cn";

const ORDER: string[] = [
  ATTENDANCE.ATTENDED,
  ATTENDANCE.LATE,
  ATTENDANCE.ABSENT,
  ATTENDANCE.RESCHEDULED,
];

/**
 * What kind of meeting this was — asked once, answered four ways, because the
 * four are mutually exclusive and each means something different for the hours.
 * The chosen option explains itself underneath rather than making the mentor
 * remember which ones charge: absent still charges, rescheduled charges nothing.
 *
 * Radios, not tick boxes: a session cannot be both absent and rescheduled, and a
 * set of checkboxes would invite exactly that.
 */
export function AttendancePicker({
  defaultValue = ATTENDANCE.ATTENDED,
  compact = false,
}: {
  defaultValue?: string;
  /** Tighter type, for the correction popover. */
  compact?: boolean;
}) {
  const [value, setValue] = useState(
    defaultValue in ATTENDANCE_META ? defaultValue : ATTENDANCE.ATTENDED,
  );

  return (
    <fieldset className="min-w-0">
      <legend
        className={cn(
          compact
            ? "text-xs font-medium text-muted-fg"
            : "text-sm text-muted-fg",
        )}
      >
        How did it go? <span className="text-accent-ink">*</span>
      </legend>
      <div className="mt-1 flex flex-wrap gap-1 rounded-xl border border-line bg-canvas p-1">
        {ORDER.map((state) => {
          const active = value === state;
          return (
            <label
              key={state}
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
                name="attendance"
                value={state}
                checked={active}
                onChange={() => setValue(state)}
                className="sr-only"
              />
              {ATTENDANCE_META[state].label}
            </label>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-muted-fg">
        {ATTENDANCE_META[value].hint}
      </p>
    </fieldset>
  );
}
