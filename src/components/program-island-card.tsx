"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties, type MouseEvent } from "react";

import { ArrowRightIcon } from "@/components/icons";
import { Meter } from "@/components/ui/meter";
import { cn } from "@/lib/cn";
import type { ProgramTone } from "@/lib/person-tone";

/**
 * A compact program "island": a few headline numbers on a card that expands
 * into the program's full page when clicked. On hover it tilts subtly in 3D
 * toward the cursor and lifts, so the grid feels tactile. Shared by the
 * dashboard and the students page (each picks its own three stats).
 *
 * `tone` is the program's own hue, matching the banner on its page, so a row of
 * cards reads as three distinct places rather than three copies.
 */
export function ProgramIslandCard({
  name,
  href,
  cohortCount,
  stats,
  caption,
  completion,
  tone,
  monogram,
}: {
  name: string;
  href: string;
  cohortCount: number;
  stats: { label: string; value: string; danger?: boolean; brand?: boolean }[];
  caption: string;
  completion?: { completed: number; allotted: number };
  tone?: ProgramTone;
  monogram?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [tilt, setTilt] = useState<CSSProperties>({});

  const onMove = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rx = ((e.clientY - r.top) / r.height - 0.5) * -5;
    const ry = ((e.clientX - r.left) / r.width - 0.5) * 5;
    setTilt({
      transform: `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-3px)`,
    });
  };

  return (
    <Link
      ref={ref}
      href={href}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({})}
      style={tilt}
      className={cn(
        "group relative block overflow-hidden rounded-xl border border-line bg-surface pb-5 pl-5 pr-5 pt-[21px] transition-[transform,box-shadow,border-color] duration-150 ease-out [transform-style:preserve-3d] hover:shadow-soft",
        tone?.cardHover ?? "hover:border-accent/60",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-x-0 top-0 h-[3px]", tone?.rule ?? "bg-line")}
      />
      {monogram && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-5 right-2 select-none text-[64px] font-black leading-none tracking-tighter text-ink/[0.04]"
        >
          {monogram}
        </span>
      )}
      <div className="relative flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-ink">{name}</h3>
        {cohortCount > 0 && (
          <span className="text-xs text-muted-fg">
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
            <dt className="text-[11px] uppercase tracking-wide text-muted-fg">
              {s.label}
            </dt>
            <dd
              className={`text-xl font-bold tabular-nums ${
                s.danger ? "text-red-700" : s.brand ? "text-accent-ink" : "text-ink"
              }`}
            >
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      {completion && completion.allotted > 0 && (
        <Meter
          className="mt-3"
          size="sm"
          pct={Math.round((completion.completed / completion.allotted) * 100)}
          ariaValueNow={completion.completed}
          ariaValueMax={completion.allotted}
          ariaLabel={`${name} hours completed`}
        />
      )}
      <p className="mt-3 text-xs text-muted-fg">{caption}</p>
      <p className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-ink">
        Open program
        <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}
