import { cn } from "@/lib/cn";

const VALUE = {
  default: "text-ink",
  brand: "text-accent-ink",
  danger: "text-red-700",
  muted: "text-muted-fg",
} as const;

/**
 * One number in a dashboard's stat strip. `lead` marks the single number the
 * page is really about (hours remaining, usually) and renders it a step
 * larger: a strip where every number is the same size has no hierarchy, so the
 * eye has to read all of them to find the one that matters.
 */
export function StatCard({
  label,
  value,
  suffix,
  tone = "default",
  lead = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: keyof typeof VALUE;
  lead?: boolean;
}) {
  return (
    <div>
      <div
        className={cn(
          "font-bold leading-none tracking-tight tabular-nums",
          lead ? "text-[42px]" : "text-3xl",
          VALUE[tone],
        )}
      >
        {value}
        {suffix && (
          <span className="ml-1 text-base font-semibold tracking-normal text-muted-fg">
            {suffix}
          </span>
        )}
      </div>
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-fg">
        {label}
      </div>
    </div>
  );
}

/** The numbers as one quiet strip between hairlines — no tile boxes. */
export function StatCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-x-12 gap-y-5 border-y border-line px-1 py-6">
      {children}
    </div>
  );
}
