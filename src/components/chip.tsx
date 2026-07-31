/** Status chip: colored dot + label, one shape everywhere. */

const TONES = {
  green: { chip: "bg-green-50 text-green-700", dot: "bg-green-500" },
  gray: { chip: "bg-canvas text-muted-fg", dot: "bg-muted-fg" },
  amber: { chip: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  red: { chip: "bg-red-50 text-red-700", dot: "bg-red-500" },
  // Work in flight, distinct from "done" green and from amber's "needs
  // attention" — a violet dot ties it to the plan half of the ledger.
  violet: { chip: "bg-plan-soft text-plan-ink", dot: "bg-plan-ink" },
} as const;

export type ChipTone = keyof typeof TONES;

export function Chip({
  tone,
  children,
}: {
  tone: ChipTone;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  // tracking-normal on purpose: a chip often sits inside a heading, and the
  // heading's tracking-tight squeezes 12px label text that was never meant to
  // carry it.
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium tracking-normal ${t.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden="true" />
      {children}
    </span>
  );
}
