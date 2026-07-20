import { cn } from "@/lib/cn";

export type CalloutTone = "brand" | "warning" | "danger" | "neutral";

const SURFACE: Record<CalloutTone, string> = {
  brand: "border-accent/40 bg-accent-soft",
  warning: "border-amber-300 bg-amber-50",
  danger: "border-red-200 bg-red-50",
  neutral: "border-line bg-surface",
};

const TITLE: Record<CalloutTone, string> = {
  brand: "text-ink",
  warning: "text-amber-800",
  danger: "text-red-800",
  neutral: "text-ink",
};

const BODY: Record<CalloutTone, string> = {
  brand: "text-ink",
  warning: "text-amber-700",
  danger: "text-red-700",
  neutral: "text-muted-fg",
};

/**
 * Tinted notice box. `row` lays it out as a single line with the action on the
 * right (the "Ready for your next session? → Book" CTA shape); otherwise it
 * stacks title, body and action. One accent per tone — no decorative color.
 */
export function Callout({
  tone = "neutral",
  title,
  children,
  action,
  row,
  className,
}: {
  tone?: CalloutTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  row?: boolean;
  className?: string;
}) {
  if (row) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-5 py-4 text-[15px]",
          SURFACE[tone],
          BODY[tone],
          className,
        )}
      >
        <div>
          {title && <span className="font-medium">{title} </span>}
          {children}
        </div>
        {action}
      </div>
    );
  }
  return (
    <div className={cn("rounded-lg border p-4", SURFACE[tone], className)}>
      {title && (
        <div className={cn("text-sm font-semibold", TITLE[tone])}>{title}</div>
      )}
      {children && (
        <div className={cn("text-sm", BODY[tone], title && "mt-1")}>
          {children}
        </div>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
