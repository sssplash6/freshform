import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type Column = { label?: ReactNode; align?: "right" };

/**
 * The shared data-table chrome: horizontal-scroll frame, hairline header on a
 * mist tint, divided rows. Callers pass their own columns and compose rows
 * from <Tr>/<Td> so column shape stays flexible.
 */
export function Table({
  columns,
  framed = true,
  children,
  className,
}: {
  columns: Column[];
  framed?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto",
        framed && "rounded-xl border border-line bg-surface",
        className,
      )}
    >
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted-fg">
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                className={cn(
                  "px-4 py-3 font-medium",
                  c.align === "right" && "text-right",
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("transition-colors hover:bg-canvas", className)}
      {...props}
    />
  );
}

export function Td({
  align,
  className,
  ...props
}: ComponentProps<"td"> & { align?: "right" }) {
  return (
    <td
      className={cn("px-4 py-3", align === "right" && "text-right", className)}
      {...props}
    />
  );
}
