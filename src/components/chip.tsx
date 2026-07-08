/** Status chip: colored dot + label, one shape everywhere. */

const TONES = {
  green: { chip: "bg-green-50 text-green-700", dot: "bg-green-500" },
  gray: { chip: "bg-mist/60 text-gray-600", dot: "bg-gray-400" },
  amber: { chip: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
} as const;

export function Chip({
  tone,
  children,
}: {
  tone: keyof typeof TONES;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${t.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden="true" />
      {children}
    </span>
  );
}
