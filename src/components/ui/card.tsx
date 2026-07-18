import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** The white bordered surface used for grouped content. Flat by default
 * (DESIGN.md prefers rules + whitespace); pass shadow classes when elevation
 * communicates real hierarchy. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-lg border border-mist bg-white", className)}
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
      <h2 className="text-base font-semibold text-navy">{title}</h2>
      {action ? (
        action
      ) : caption ? (
        <p className="text-xs text-gray-500">{caption}</p>
      ) : null}
    </div>
  );
}
