import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons";

/**
 * A compact program "island": a few headline numbers on a card that expands
 * into the program's full page when clicked. Shared by the dashboard and
 * the students page (each picks its own three stats).
 */
export function ProgramIslandCard({
  name,
  href,
  cohortCount,
  stats,
  caption,
}: {
  name: string;
  href: string;
  cohortCount: number;
  stats: { label: string; value: string; danger?: boolean; brand?: boolean }[];
  caption: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-mist bg-white p-5 transition hover:border-brand/60 hover:shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-navy">{name}</h3>
        {cohortCount > 0 && (
          <span className="text-xs text-gray-500">
            {cohortCount} cohort{cohortCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {/* Tailwind needs literal class names — no template-built grid-cols. */}
      <dl
        className={`mt-3 grid gap-2 text-center ${
          stats.length === 4 ? "grid-cols-4" : stats.length === 2 ? "grid-cols-2" : "grid-cols-3"
        }`}
      >
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">
              {s.label}
            </dt>
            <dd
              className={`text-xl font-bold tabular-nums ${
                s.danger ? "text-red-700" : s.brand ? "text-brand-deep" : "text-navy"
              }`}
            >
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-gray-500">{caption}</p>
      <p className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-navy">
        Open program
        <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}
