import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { GLYPH, type Severity, type Status } from "@/lib/status";

/**
 * One chip, for every state in the product.
 *
 * What it replaces was five tones named after colours — green, amber, red,
 * gray, violet — chosen at the call site, which is how "Booking link set" ended
 * up the same green as "Done" and a mentor's identity chip ended up the same
 * amber as "No-show". A caller can no longer pick a colour: it picks a SEVERITY,
 * and severity picks the colour.
 *
 * Two shapes:
 *
 *   <StatusChip status={s} />                        the destination
 *   <StatusChip severity="attention">Pending</…>     while a page still derives
 *                                                    its own labels
 *
 * The second exists because the label and the severity migrate at different
 * times: a page can stop choosing colours today, and start reading its wording
 * from `lib/status.ts` when that page is reshaped. Every remaining use of the
 * second form is a page that has not been through the reorganisation yet.
 */
const SURFACE: Record<Severity, string> = {
  // Grey is the absence of a signal, so it carries no glyph — a fact does not
  // need to announce itself, and "○" on every "Extra" chip is just noise.
  neutral: "bg-canvas text-muted-fg",
  ok: "bg-canvas text-ink",
  attention: "bg-warn-soft text-warn-ink",
  problem: "bg-danger-soft text-danger-ink",
};

/** Grey has no colour to be alone with, so only the coloured states need one. */
const SHOWS_GLYPH: Record<Severity, boolean> = {
  neutral: false,
  ok: true,
  attention: true,
  problem: true,
};

type Props = {
  className?: string;
  /** Override the glyph — progress states use ○ and ◐ as shapes, not signals. */
  glyph?: string;
} & (
  | { status: Status; severity?: never; children?: never }
  | { status?: never; severity: Severity; children: React.ReactNode }
);

export function StatusChip({ className, glyph, ...rest }: Props) {
  const severity = rest.status ? rest.status.severity : rest.severity;
  const body = rest.status ? rest.status.label : rest.children;
  const mark = glyph ?? (SHOWS_GLYPH[severity] ? GLYPH[severity] : null);

  return (
    <span
      // Deliberately wrappable. The old chip was `whitespace-nowrap` while
      // carrying sentences like "Rescheduled, no time charged", so a narrow
      // column could not break it and the row grew sideways instead.
      className={cn(
        "inline-flex items-baseline gap-1 rounded-full px-2 py-0.5 text-xs font-medium tracking-normal",
        SURFACE[severity],
        className
      )}
      title={rest.status?.explanation}
    >
      {mark && (
        <span aria-hidden="true" className="font-semibold leading-none">
          {mark}
        </span>
      )}
      <span>{body}</span>
    </span>
  );
}

/**
 * An allocation's use-by date, and whether it has gone.
 *
 * `now` is a prop rather than a call to the clock: this used to read
 * `Date.now()` while rendering, which made the answer depend on the moment a
 * component happened to paint and put an impure call inside a render pass. The
 * page computes `now` once and hands the same instant to every row, so a table
 * cannot disagree with itself.
 */
export function DeadlineText({
  deadline,
  now,
  className,
}: {
  deadline: Date | null;
  now: Date;
  className?: string;
}) {
  if (!deadline) return <span className="text-muted-fg">—</span>;
  const expired = deadline.getTime() < now.getTime();
  // Not a chip: this sits in a column of dates, and a chip among dates reads as
  // a different kind of value.
  return (
    <span className={cn(expired && "font-medium text-danger-ink", className)}>
      {formatDate(deadline)}
      {expired && " · expired"}
    </span>
  );
}
