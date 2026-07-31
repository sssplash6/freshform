import Link from "next/link";

import { ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

/**
 * The hours filter on a mentor's page, and the URL contract behind it. Both
 * live here so there is one place that decides what `?period=90d&from=…` means.
 *
 * Plain links and a GET form — no client JS. Each pill is a URL, so a filtered
 * view is bookmarkable and the back button steps through filters the way it
 * should.
 */

export const PERIODS = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
] as const;

export type PeriodValue = (typeof PERIODS)[number]["value"];

export type HoursQuery = {
  program?: string;
  period?: string;
  from?: string;
  to?: string;
};

export type HoursWindow = {
  /** Inclusive bounds handed to the query; undefined means unbounded. */
  from?: Date;
  to?: Date;
  /** Which pill is lit: a preset, "custom", or "all". */
  active: PeriodValue | "custom" | "all";
  /** How the window reads in a sentence: "the last 30 days", "all time". */
  label: string;
  /** What the two date inputs show — only ever the user's own range. */
  fromValue: string;
  toValue: string;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Dates are stored at UTC midnight, so every bound is computed in UTC. */
function utcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

function parseDay(value: string | undefined, endOfDay = false): Date | null {
  if (!value || !DATE_ONLY.test(value)) return null;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Turn the URL's `period` / `from` / `to` into real dates. An explicit range
 * beats a preset, since typing one is the more deliberate act; a backwards
 * range is read the way it was obviously meant rather than returning nothing.
 */
export function resolveWindow({ period, from, to }: HoursQuery): HoursWindow {
  let fromDay = DATE_ONLY.test(from ?? "") ? from! : "";
  let toDay = DATE_ONLY.test(to ?? "") ? to! : "";
  // Both are YYYY-MM-DD, so string order is date order: a backwards range is
  // read the way it was plainly meant rather than matching nothing.
  if (fromDay && toDay && fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];

  const start = parseDay(fromDay);
  const end = parseDay(toDay, true);
  if (start || end) {
    return {
      from: start ?? undefined,
      to: end ?? undefined,
      active: "custom",
      label: start
        ? end
          ? `${formatDate(start)} – ${formatDate(end)}`
          : `since ${formatDate(start)}`
        : `up to ${formatDate(end!)}`,
      fromValue: fromDay,
      toValue: toDay,
    };
  }

  const today = utcToday();
  const daysBack = (days: number) =>
    new Date(today.getTime() - days * 24 * 60 * 60 * 1000);

  switch (period) {
    case "30d":
      return {
        from: daysBack(30),
        active: "30d",
        label: "the last 30 days",
        fromValue: "",
        toValue: "",
      };
    case "90d":
      return {
        from: daysBack(90),
        active: "90d",
        label: "the last 90 days",
        fromValue: "",
        toValue: "",
      };
    case "year":
      return {
        from: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)),
        active: "year",
        label: `${today.getUTCFullYear()}`,
        fromValue: "",
        toValue: "",
      };
    default:
      return { active: "all", label: "all time", fromValue: "", toValue: "" };
  }
}

function href(base: string, params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `${base}?${query}` : base;
}

function Pill({
  children,
  href: to,
  active,
}: {
  children: React.ReactNode;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={to}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors",
        active
          ? "border-brand bg-brand text-white"
          : "border-line bg-surface text-muted-fg hover:border-brand/40 hover:text-ink"
      )}
    >
      {children}
    </Link>
  );
}

function Row({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // items-start, so opening the custom range grows the row downward instead
    // of nudging every pill beside it. leading-9 keeps the label on the pills'
    // centre line.
    <div
      className={cn(
        "flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 sm:px-5",
        className
      )}
    >
      <span className="w-14 shrink-0 text-[10px] font-bold uppercase leading-9 tracking-[0.11em] text-muted-fg">
        {label}
      </span>
      {children}
    </div>
  );
}

const dateInput =
  "h-9 min-h-9 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink transition-colors hover:border-brand/40 focus:border-brand focus:outline-none";

export function MentorHoursFilter({
  base,
  programs,
  programId,
  window: win,
}: {
  /** The page's own path, which every pill links back to. */
  base: string;
  programs: { id: string; name: string }[];
  programId?: string;
  window: HoursWindow;
}) {
  const period = win.active === "custom" || win.active === "all" ? undefined : win.active;
  const custom = win.active === "custom";

  return (
    <div className="rounded-2xl border border-line bg-surface">
      {programs.length > 1 && (
        <Row label="Program" className="border-b border-line/60">
          <div className="flex flex-wrap gap-1.5">
            <Pill
              href={href(base, { period, from: win.fromValue, to: win.toValue })}
              active={!programId}
            >
              All programs
            </Pill>
            {programs.map((p) => (
              <Pill
                key={p.id}
                href={href(base, {
                  program: p.id,
                  period,
                  from: win.fromValue,
                  to: win.toValue,
                })}
                active={programId === p.id}
              >
                {p.name}
              </Pill>
            ))}
          </div>
        </Row>
      )}

      <Row label="Period">
        <div className="flex flex-wrap items-start gap-1.5">
          {/* A preset replaces a typed range, so these drop from/to. */}
          <Pill
            href={href(base, { program: programId })}
            active={win.active === "all"}
          >
            All time
          </Pill>
          {PERIODS.map((p) => (
            <Pill
              key={p.value}
              href={href(base, { program: programId, period: p.value })}
              active={win.active === p.value}
            >
              {p.label}
            </Pill>
          ))}

          {/*
            A native disclosure: two date fields are a rarely-wanted control, so
            they stay folded behind their own pill until asked for — and open by
            default when a typed range IS what the page is showing. Still no
            client JS; any pill or Apply navigates, which closes it again.
          */}
          <details open={custom} className="group">
            <summary
              className={cn(
                "inline-flex h-9 cursor-pointer list-none items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors [&::-webkit-details-marker]:hidden",
                custom
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-muted-fg hover:border-brand/40 hover:text-ink"
              )}
            >
              {custom ? win.label : "Custom range"}
              <ChevronDownIcon className="ml-1.5 h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </summary>

            <form
              method="get"
              action={base}
              className="rise-in mt-2 flex flex-wrap items-center gap-1.5"
            >
              {programId && (
                <input type="hidden" name="program" value={programId} />
              )}
              <input
                type="date"
                name="from"
                defaultValue={win.fromValue}
                aria-label="Hours from"
                className={dateInput}
              />
              <span aria-hidden="true" className="text-muted-fg">
                –
              </span>
              <input
                type="date"
                name="to"
                defaultValue={win.toValue}
                aria-label="Hours to"
                className={dateInput}
              />
              {/* Matches the secondary button, sized to the pills beside it. */}
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-brand/80 px-3.5 text-[13px] font-medium text-brand transition-colors hover:bg-brand hover:text-white"
              >
                Apply
              </button>
              {custom && (
                <Link
                  href={href(base, { program: programId })}
                  className="px-1 text-[13px] font-medium text-muted-fg hover:text-ink"
                >
                  Clear
                </Link>
              )}
            </form>
          </details>
        </div>
      </Row>
    </div>
  );
}
