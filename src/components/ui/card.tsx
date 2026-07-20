import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** The white bordered surface used for grouped content. Flat by default
 * (DESIGN.md prefers rules + whitespace); pass shadow classes when elevation
 * communicates real hierarchy. `as` picks the element so callers keep correct
 * semantics (e.g. a card that is really a <section>). */
export function Card({
  as: As = "div",
  className,
  ...props
}: ComponentProps<"div"> & { as?: "div" | "section" | "article" }) {
  return (
    <As
      className={cn("rounded-xl border border-line bg-surface", className)}
      {...props}
    />
  );
}

/** Title on the left, an optional caption or action on the right. */
export function SectionHeader({
  title,
  caption,
  action,
  className,
}: {
  title: React.ReactNode;
  caption?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1",
        className,
      )}
    >
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {action ? (
        action
      ) : caption ? (
        <p className="text-xs text-muted-fg">{caption}</p>
      ) : null}
    </div>
  );
}
