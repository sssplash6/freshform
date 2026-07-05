/** Small metric tile used across the dashboards. */
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
    <div className="rounded-lg border border-mist bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

export function StatCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
  );
}
