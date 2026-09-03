import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";

/**
 * The student's balance as a ring that draws itself once on load: used
 * sweep round, the number in the middle is what's left. A student opens this app
 * to answer one question, so that answer gets a shape rather than a row in a
 * table of five other numbers.
 *
 * Server-rendered, animated in pure CSS (see `ring-draw`), so it works with no
 * client JS and reduced-motion simply skips the sweep.
 */
export function HoursRing({
  used,
  allotted,
  forfeited = 0,
  remaining,
  className,
}: {
  used: number;
  allotted: number;
  /** Minutes lost to a passed deadline. Part of the sweep; never spendable. */
  forfeited?: number;
  /**
   * What is actually left, from `allocationSummary`.
   *
   * Passed in rather than derived here, because deriving it was a bug: this
   * component used `allotted - used` and the ledger uses
   * `allotted - used - forfeited`, so any student with an expired allocation
   * read a bigger number inside the ring than in the sentence beside it.
   */
  remaining: number;
  className?: string;
}) {
  const size = 132;
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Time that is gone is time that is gone, whether it was spent or forfeited:
  // the sweep shows what the student can no longer book.
  const gone = used + forfeited;
  const pct = allotted > 0 ? Math.min(1, Math.max(0, gone / allotted)) : 0;
  const overdrawn = remaining < 0;
  // A full sweep when overdrawn: the ring can't show more than all of it, and
  // the red number below carries the rest of the message.
  const sweep = overdrawn ? 1 : pct;
  const offset = circumference * (1 - sweep);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-line"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ ["--ring-circumference" as string]: `${circumference}` }}
          className={cn(
            "ring-draw",
            overdrawn ? "stroke-danger" : "stroke-accent",
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className={cn(
            "text-[30px] font-bold leading-none tracking-tight tabular-nums",
            overdrawn ? "text-danger-ink" : "text-ink",
          )}
        >
          {formatDuration(overdrawn ? -remaining : remaining)}
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-fg">
          {overdrawn ? "over" : "time left"}
        </div>
      </div>
      {/* The ring is decorative; the numbers it encodes are stated for readers
          who never see it. */}
      <span className="sr-only">
        {formatDuration(used)} of {formatDuration(allotted)} used.
      </span>
    </div>
  );
}
