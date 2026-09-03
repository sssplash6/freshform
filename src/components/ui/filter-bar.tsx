import Form from "next/form";
import Link from "next/link";

import { SearchIcon } from "@/components/icons";
import { Select } from "@/components/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  PAGE_PARAMS,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  activeFilterCount,
  presetHref,
  presetIsActive,
  readParam,
  resetHref,
  type DateWindow,
  type FilterOption,
  type FilterPreset,
  type SearchParams,
  type SearchSurface,
} from "@/lib/filters";

/**
 * One bar above every list: what you are looking for, and what the list is
 * showing you now.
 *
 * It replaces four things that did this job in four shapes.
 * `mentor-hours-filter.tsx` was 322 lines in which the URL contract, the date
 * arithmetic and the markup were a single lump — two rows of link-pills, a
 * nested `<details>`, its own second `<form>`, and a hand-rolled
 * preset/custom/all state machine, none of it reachable by a test. Beside it,
 * `ui/search-form.tsx` and the hand-rolled cards on `/admin/students` and
 * `/mentor/sessions` each re-derived a subset of the same rules and each got a
 * different piece wrong: one lost the program when you searched, one carried
 * the page number into a new filter, one filtered in JavaScript over every row
 * in the school.
 *
 * So the rules moved to `lib/filters.ts`, which is provable, and what is left
 * here is only the drawing. This file computes no dates, decides no
 * precedence, and invents no words.
 *
 * TWO KINDS OF CONTROL, and the difference is the reason the bar is legible.
 *
 * A **value** — the search box, a select, a date — is something you compose,
 * so it lives in one GET form with one Apply. A phone keyboard makes three
 * separate submits for three fields intolerable, and a select that navigated on
 * change would fire a page load in the middle of typing a name.
 *
 * A **chip** is a single fact you either want or do not, so it is a plain link
 * that acts on one click. Chips are `brand-soft` when lit and never orange:
 * orange is hours, and a lit filter is chrome.
 *
 * Both write the same URL, so a filtered list is a link a person can send, the
 * back button steps through filters, and every narrowing is in the query rather
 * than in a pass over rows already fetched.
 */

/** One select in the bar. Its `name` must be in `FILTER_PARAMS`. */
export type FilterSelect = {
  /** The param it owns: `program`, `student`, `mentor`, `category`. */
  name: string;
  /** Above the control. Two words. */
  label: string;
  /** What choosing nothing means: "All programs". */
  all: string;
  options: readonly FilterOption[];
  /** Force the list's own search box on or off; defaults to on past eight. */
  searchable?: boolean;
  /** Float this control's last few picks to the top, under "Recent". */
  recentKey?: string;
};

export function FilterBar({
  basePath,
  params,
  q,
  selects = [],
  presets = [],
  dateRange,
  summary,
  reset = true,
  className,
}: {
  /** The list's own path, which every link and the form point back at. */
  basePath: string;
  /** The page's `searchParams`, awaited. Everything the bar knows comes from it. */
  params: SearchParams;
  /**
   * Which surface's search box, or none. The surface — not a placeholder —
   * because the fields it looks in are a decision `lib/filters.ts` makes once
   * (REDESIGN.md 5.5) and the box's own words are generated from that list. A
   * box that named fields it did not search was the defect being removed.
   */
  q?: SearchSurface;
  selects?: readonly FilterSelect[];
  /** Chips, including `DATE_PRESETS` on the lists that want them. */
  presets?: readonly FilterPreset[];
  /** The window from `readDateWindow`, on a list that filters by date. */
  dateRange?: DateWindow;
  /** "12 students for “aziza”", from `filterSummary`. */
  summary?: React.ReactNode;
  /** Offer a Reset once something is on. */
  reset?: boolean;
  className?: string;
}) {
  // Which params the visible controls will re-post, so everything else has to
  // ride along hidden. A GET form replaces the whole query string, which is
  // how three of the four cards this replaces silently dropped a filter the
  // moment you touched another one.
  //
  // Page numbers are the deliberate exception: they are simply not carried, so
  // narrowing the list always lands on its own first page instead of on page
  // four of one result, which is a blank screen that reads as data loss.
  const posted = new Set<string>([
    ...(q ? ["q"] : []),
    ...selects.map((s) => s.name),
    ...(dateRange ? ["from", "to"] : []),
  ]);
  const carried = Object.keys(params).filter(
    (key) => !posted.has(key) && !PAGE_PARAMS.includes(key) && readParam(params, key)
  );

  const count = activeFilterCount(params);
  const showValues = Boolean(q || selects.length > 0 || dateRange);
  const showFoot = Boolean(summary) || (reset && count > 0);

  return (
    <div className={cn("rounded-2xl border border-line bg-surface", className)}>
      {showValues && (
        <Form
          action={basePath}
          role={q ? "search" : undefined}
          aria-label="Filters"
          // items-end so the labels line up along the controls' bottom edge,
          // and wrap so the bar grows downward on a phone instead of pushing
          // the page sideways.
          className="flex flex-wrap items-end gap-3 p-3 sm:p-4"
        >
          {carried.map((key) => (
            <input key={key} type="hidden" name={key} value={readParam(params, key)} />
          ))}

          {q && (
            // basis-full: on a 390px screen the box takes its own line and the
            // selects sit under it, rather than three controls sharing 350px.
            <label className="min-w-0 basis-full text-sm sm:min-w-52 sm:flex-1 sm:basis-auto">
              <span className="block text-muted-fg">{SEARCH_LABEL[q]}</span>
              <span className="relative mt-1 block">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
                <Input
                  type="search"
                  name="q"
                  defaultValue={readParam(params, "q")}
                  placeholder={SEARCH_PLACEHOLDER[q]}
                  className="pl-9"
                />
              </span>
            </label>
          )}

          {/*
            A <div> and not a <label>, unlike the fields either side of it.
            `Select` carries its own `ariaLabel`, and its value rides a 1px
            transparent input so a required select can be caught by the browser
            — which is also the first labelable element inside it. Wrapping it
            in a label therefore points the caption at something invisible:
            clicking the word "Program" focused a hidden input instead of
            opening the list, in all three of the cards this replaces.
          */}
          {selects.map((select) => (
            <div key={select.name} className="min-w-0 basis-full text-sm sm:basis-auto">
              <span className="block text-muted-fg">{select.label}</span>
              <span className="mt-1 block sm:w-48">
                <Select
                  name={select.name}
                  ariaLabel={select.label}
                  options={[...select.options]}
                  placeholder={select.all}
                  defaultValue={readParam(params, select.name)}
                  required={false}
                  searchable={select.searchable}
                  recentKey={select.recentKey}
                />
              </span>
            </div>
          ))}

          {dateRange && (
            <div className="flex min-w-0 basis-full items-end gap-2 sm:basis-auto">
              <label className="min-w-0 flex-1 text-sm sm:w-40 sm:flex-none">
                <span className="block text-muted-fg">From</span>
                {/* The value has to be YYYY-MM-DD — the control accepts nothing
                    else — and it is the string out of the URL, never a Date
                    reformatted here. It shows only what was typed: a preset
                    leaves these empty so nobody submits a range they never
                    chose. */}
                <Input
                  type="date"
                  name="from"
                  defaultValue={dateRange.fromValue}
                  aria-label="Filter from"
                  className="mt-1 block"
                />
              </label>
              <label className="min-w-0 flex-1 text-sm sm:w-40 sm:flex-none">
                <span className="block text-muted-fg">To</span>
                <Input
                  type="date"
                  name="to"
                  defaultValue={dateRange.toValue}
                  aria-label="Filter to"
                  className="mt-1 block"
                />
              </label>
            </div>
          )}

          {/* 44px, the same as every other primary action: this one is pressed
              on a phone more than anywhere else. */}
          <Button type="submit" size="md">
            Apply
          </Button>
        </Form>
      )}

      {presets.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap gap-1.5 px-3 py-2.5 sm:px-4",
            showValues && "border-t border-line"
          )}
        >
          {presets.map((preset) => (
            <Chip
              key={Object.entries(preset.params).map(([k, v]) => `${k}=${v}`).join("&")}
              href={presetHref(basePath, params, preset)}
              label={preset.label}
              hint={preset.hint}
              active={presetIsActive(params, preset)}
            />
          ))}
        </div>
      )}

      {showFoot && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-4 px-3 sm:px-4",
            (showValues || presets.length > 0) && "border-t border-line"
          )}
        >
          {/* aria-live, so a reader who filters with the keyboard is told how
              many rows are left without going hunting for the number. */}
          <p className="min-w-0 py-2.5 text-xs text-muted-fg" aria-live="polite">
            {summary}
          </p>
          {reset && count > 0 && (
            <Link
              href={resetHref(basePath, params)}
              className="inline-flex min-h-11 items-center text-xs font-semibold text-brand hover:text-brand-dark"
            >
              Reset
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One chip: a filter you either want or do not.
 *
 * `aria-pressed` rather than `aria-current`: a lit chip is a toggle that is on,
 * not the page you are on, and the link's own href is what turns it off again.
 */
function Chip({
  href,
  label,
  hint,
  active,
}: {
  href: string;
  label: string;
  hint?: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      title={hint}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors",
        active
          ? "border-brand bg-brand-soft font-semibold text-brand"
          : "border-line bg-surface text-muted-fg hover:border-brand/40 hover:text-ink"
      )}
    >
      {label}
    </Link>
  );
}
