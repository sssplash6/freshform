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
        ? "text-brand-deep"
        : "text-navy";

  return (
    <div>
      <div
        className={`text-4xl font-bold tracking-tight tabular-nums ${valueClass}`}
      >
        {value}
      </div>
      <div className="mt-1 text-sm text-gray-500">{label}</div>
    </div>
  );
}

/** The numbers as one quiet strip between hairlines — no tile boxes. */
export function StatCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-14 gap-y-5 border-y border-mist px-1 py-6">
      {children}
    </div>
  );
}
