import Link from "next/link";

import { cn } from "@/lib/cn";

/** Every list page here shows the same slice size, so paging feels uniform. */
export const PAGE_SIZE = 25;

/** 1-based page number from a query string, clamped to something sane. */
export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 1 ? Math.min(n, 10_000) : 1;
}

/**
 * Build a href for another page of the same list, carrying every other filter
 * along — dropping the ones that are empty so a shared link stays readable.
 */
export function pageHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number,
  param = "page",
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  if (page > 1) search.set(param, String(page));
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Prev/next paging with the slice stated in words.
 *
 * These lists were unbounded: every mentor, every session, every piece of
 * feedback ever written, read into memory and rendered in full. That is fine
 * with a seed database and quietly ruinous a year in, so each list now asks for
 * one page at a time and says where it is. Links, not buttons, so a page is
 * shareable and the back button behaves.
 */
export function Pagination({
  basePath,
  params,
  page,
  pageSize = PAGE_SIZE,
  total,
  unit,
  param = "page",
  className,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize?: number;
  total: number;
  /** What is being counted, plural: "sessions", "mentors". */
  unit: string;
  /** Query key for the page number, for pages that paginate two lists. */
  param?: string;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  const step = (to: number, label: string, disabled: boolean) =>
    disabled ? (
      <span
        aria-disabled="true"
        className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-sm text-muted-fg/60"
      >
        {label}
      </span>
    ) : (
      <Link
        href={pageHref(basePath, params, to, param)}
        rel={label === "Newer" || label === "Previous" ? "prev" : "next"}
        className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-sm text-ink transition-colors hover:border-brand/40 hover:text-brand"
      >
        {label}
      </Link>
    );

  return (
    <nav
      aria-label={`${unit} pages`}
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2",
        className,
      )}
    >
      <p className="text-xs text-muted-fg" aria-live="polite">
        {total <= pageSize ? (
          <>
            {total} {unit}
          </>
        ) : (
          <>
            {first}–{last} of {total} {unit} · page {page} of {pages}
          </>
        )}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          {step(page - 1, "Previous", page <= 1)}
          {step(page + 1, "Next", page >= pages)}
        </div>
      )}
    </nav>
  );
}
