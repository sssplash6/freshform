import { formatHours } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Where a student's hours actually went, as one bar and its key.
 *
 * The ring answers "how many left?"; this answers the question underneath it,
 * which the numbers alone made people do arithmetic for: an allotment splits
 * into hours delivered, hours charged for meetings missed, hours lost to a
 * deadline, and hours still there. Reading those four out of a strip of stat
 * cards meant holding four figures at once and subtracting; as segments of one
 * bar the proportions are the answer.
 *
 * Extra hours sit OUTSIDE the bar on purpose. They were delivered but charged
 * to nobody, so putting them inside an allotment they were never part of would
 * make the bar lie about what was bought.
 */

type Segment = {
  key: string;
  label: string;
  hours: number;
  /** Bar fill. */
  fill: string;
  /** Legend swatch + figure color. */
  ink: string;
};

export function HoursBreakdown({
  allotted,
  completed,
  missed,
  forfeited,
  remaining,
  extra = 0,
  className,
}: {
  allotted: number;
  completed: number;
  missed: number;
  forfeited: number;
  remaining: number;
  extra?: number;
  className?: string;
}) {
  const overdrawn = remaining < 0;
  const segments: Segment[] = [
    {
      key: "completed",
      label: "Delivered",
      hours: completed,
      fill: "bg-accent",
      ink: "text-accent-ink",
    },
    {
      key: "missed",
      label: "Missed, charged",
      hours: missed,
      fill: "bg-amber-400",
      ink: "text-amber-700",
    },
    {
      key: "forfeited",
      label: "Expired unused",
      hours: forfeited,
      fill: "bg-red-400",
      ink: "text-red-700",
    },
    {
      key: "remaining",
      label: overdrawn ? "Overdrawn" : "Still yours",
      hours: overdrawn ? -remaining : remaining,
      fill: overdrawn ? "bg-red-500" : "bg-line",
      ink: overdrawn ? "text-red-700" : "text-ink",
    },
  ];

  // The bar is drawn over whichever is larger — the allotment, or what has
  // actually been drawn against it. Without that an overdrawn student's bar
  // would be a full accent block with the overdraw invisible past its end.
  const drawn = completed + missed + forfeited;
  const span = Math.max(allotted, drawn + (overdrawn ? -remaining : 0), 0.01);

  const shown = segments.filter((s) => s.hours > 0.001);

  return (
    <div className={className}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-line">
        {shown.map((s) => (
          <div
            key={s.key}
            className={cn("h-full", s.fill)}
            style={{ width: `${(s.hours / span) * 100}%` }}
          />
        ))}
      </div>

      {/* The key is also the readout: a swatch is only useful next to the
          figure it stands for. */}
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2.5">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-fg">
            Allotted
          </dt>
          <dd className="mt-0.5 text-[15px] font-bold tabular-nums text-ink">
            {formatHours(allotted)}
            <span className="ml-1 text-xs font-medium text-muted-fg">h</span>
          </dd>
        </div>
        {shown.map((s) => (
          <div key={s.key}>
            <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-fg">
              <span
                aria-hidden="true"
                className={cn("h-2 w-2 shrink-0 rounded-full", s.fill)}
              />
              {s.label}
            </dt>
            <dd
              className={cn(
                "mt-0.5 text-[15px] font-bold tabular-nums",
                s.ink,
              )}
            >
              {formatHours(s.hours)}
              <span className="ml-1 text-xs font-medium text-muted-fg">h</span>
            </dd>
          </div>
        ))}
        {extra > 0 && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-fg">
              Extra, beyond plan
            </dt>
            <dd className="mt-0.5 text-[15px] font-bold tabular-nums text-ink">
              {formatHours(extra)}
              <span className="ml-1 text-xs font-medium text-muted-fg">h</span>
            </dd>
          </div>
        )}
      </dl>

      {extra > 0 && (
        <p className="mt-2.5 text-xs text-muted-fg">
          {formatHours(extra)} hours were given on top of the allotment and drew
          none of it down, so they sit outside the bar.
        </p>
      )}
    </div>
  );
}
