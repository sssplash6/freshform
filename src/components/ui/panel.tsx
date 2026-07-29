import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * A titled region of a page, with a hairline of color across the top and a
 * tinted header. The tone says who owns the region: `log` (amber) is filled in
 * by mentors logging sessions, `plan` (violet) is assigned by an admin, `total`
 * (brand blue) is derived, `neutral` is everything else. Carried over from the
 * spreadsheet these views replace, where the same split was color-coded.
 */
export type PanelTone = "log" | "plan" | "total" | "neutral";

const RULE: Record<PanelTone, string> = {
  log: "bg-log-ink/70",
  plan: "bg-plan-ink/70",
  total: "bg-brand/70",
  neutral: "bg-line",
};

const HEADER: Record<PanelTone, string> = {
  log: "bg-log-soft border-log-line",
  plan: "bg-plan-soft border-plan-line",
  total: "bg-brand-soft border-brand/15",
  neutral: "bg-canvas border-line",
};

const EYEBROW: Record<PanelTone, string> = {
  log: "text-log-ink",
  plan: "text-plan-ink",
  total: "text-brand",
  neutral: "text-muted-fg",
};

export function Panel({
  tone = "neutral",
  className,
  children,
  ...props
}: ComponentProps<"section"> & { tone?: PanelTone }) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-line bg-surface",
        className,
      )}
      {...props}
    >
      <div className={cn("h-[3px] w-full", RULE[tone])} aria-hidden="true" />
      {children}
    </section>
  );
}

/**
 * The panel's header strip: a small-caps eyebrow naming who owns this data, a
 * title with real weight, and an optional caption or action on the right.
 */
export function PanelHeader({
  tone = "neutral",
  eyebrow,
  title,
  caption,
  action,
}: {
  tone?: PanelTone;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  caption?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b px-4 py-3.5 sm:px-5",
        HEADER[tone],
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div
            className={cn(
              "text-[10px] font-bold uppercase tracking-[0.09em]",
              EYEBROW[tone],
            )}
          >
            {eyebrow}
          </div>
        )}
        <h2 className="mt-0.5 truncate text-[17px] font-bold tracking-tight text-ink">
          {title}
        </h2>
      </div>
      {action ??
        (caption ? (
          <p className="text-xs text-muted-fg">{caption}</p>
        ) : null)}
    </div>
  );
}
