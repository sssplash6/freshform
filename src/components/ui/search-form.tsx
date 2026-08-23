import Link from "next/link";

import { SearchIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/**
 * A GET form that filters a server-rendered list. Deliberately a form and not a
 * live-filtering input: the list it narrows is a page of a much larger table, so
 * the filtering has to happen in the query rather than over whatever happened to
 * be loaded. Submitting drops `page` on the floor, which is what you want — a
 * new filter starts at its own first page.
 */
export function SearchForm({
  action,
  name = "q",
  defaultValue = "",
  label,
  placeholder,
  hidden,
  className,
  children,
}: {
  /** The path this list lives at. */
  action: string;
  name?: string;
  defaultValue?: string;
  label: string;
  placeholder?: string;
  /** Filters to carry through the search, as hidden fields. */
  hidden?: Record<string, string | undefined>;
  className?: string;
  /** Extra controls (more selects, a date range) rendered before the buttons. */
  children?: React.ReactNode;
}) {
  return (
    <form
      action={action}
      className={cn(
        "flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4",
        className,
      )}
    >
      {Object.entries(hidden ?? {}).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null,
      )}
      <label className="block min-w-52 flex-1 text-sm">
        <span className="text-muted-fg">{label}</span>
        <span className="relative mt-0.5 block">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
          <input
            type="search"
            name={name}
            defaultValue={defaultValue}
            placeholder={placeholder}
            className={cn(inputClasses, "pl-9")}
          />
        </span>
      </label>
      {children}
      <Button type="submit">Search</Button>
      {defaultValue && (
        <Link
          href={action}
          className="inline-flex h-10 items-center rounded-lg px-3 text-sm text-muted-fg transition-colors hover:bg-canvas hover:text-ink"
        >
          Clear
        </Link>
      )}
    </form>
  );
}
