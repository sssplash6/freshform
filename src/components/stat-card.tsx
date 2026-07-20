/** One number in a dashboard's stat strip. */
export function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "brand" | "danger";
}) {
  const valueClass =
    tone === "danger"
      ? "text-red-700"
      : tone === "brand"
        ? "text-accent-ink"
        : "text-ink";

  return (
    <div>
      <div
        className={`text-3xl font-bold leading-none tabular-nums ${valueClass}`}
      >
        {value}
      </div>
      <div className="mt-1 text-sm text-muted-fg">{label}</div>
    </div>
  );
}

/** The numbers as one quiet strip between hairlines — no tile boxes. */
export function StatCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-14 gap-y-5 border-y border-line px-1 py-6">
      {children}
    </div>
  );
}
