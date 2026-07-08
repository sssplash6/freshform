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
      ? "text-red-600"
      : tone === "brand"
        ? "text-brand-deep"
        : "text-navy";

  return (
    <div>
      <div className={`text-xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-gray-500">{label}</div>
    </div>
  );
}

/** The numbers as one quiet strip between hairlines — no tile boxes. */
export function StatCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4 border-y border-mist px-1 py-4">
      {children}
    </div>
  );
}
