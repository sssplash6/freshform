import { ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * A section folded away until it is asked for.
 *
 * Built on native `<details>`, which is the one place this app prefers a
 * platform control without argument: keyboard and screen-reader behaviour
 * arrive free, it works before hydration, and browsers expand a closed
 * `<details>` to reveal a find-in-page hit — which every `useState` version
 * silently breaks. Six hand-rolled idioms existed before this: two styled
 * `<details>`, a "Show ▾ / Hide ▴" pair of text glyphs, a "New program" toggle
 * and a "+ Add a cohort" link in the same file, and an inline Edit row.
 *
 * WHAT MAY BE FOLDED is the harder half, and it is not "anything that makes the
 * page shorter" — collapsing is the easiest way to make a page look calm while
 * leaving its mess in place. In order, stopping at the first yes:
 *
 *   Is it what the page is FOR?          Show it.
 *   Does it answer a different question? Give it an address, not a fold.
 *   Is it free text past its clamp?      That is ExpandableText.
 *   Is it a menu of row actions?         That is RowActionMenu.
 *   An occasional action on this page's
 *     subject, or a settled subset?      Now it has earned a fold.
 *   Anything else                        It is noise. Delete it.
 *
 * Two rules worth stating out loud:
 *
 * `count` shows BEFORE the fold is opened. Collapsing may hide the rows; it may
 * never hide the magnitude. A count of zero renders nothing at all — an empty
 * disclosure is a control that lies about having contents.
 *
 * Height is never animated. Reflowing a table under the reader's cursor is
 * worse than an instant open, and the chevron's rotation is enough to say what
 * happened.
 */
export function Disclosure({
  label,
  count,
  hint,
  defaultOpen = false,
  children,
  className,
}: {
  /** Names what is inside, as a noun or an imperative. Never "More" or "Show". */
  label: React.ReactNode;
  /** Shown in the summary when the fold hides countable rows. */
  count?: number;
  /** One line under the summary, ≤ 12 words. */
  hint?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  // Nothing to open.
  if (count === 0) return null;

  return (
    <details open={defaultOpen} className={cn("group", className)}>
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand",
          "hover:text-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2",
          // Safari still paints its own triangle without this.
          "[&::-webkit-details-marker]:hidden"
        )}
      >
        <ChevronDownIcon
          className="h-4 w-4 shrink-0 -rotate-90 transition-transform group-open:rotate-0"
          aria-hidden="true"
        />
        <span>{label}</span>
        {count != null && (
          <span className="tabular-nums text-muted-fg">· {count}</span>
        )}
      </summary>
      {hint && <p className="mb-2 ml-5.5 text-xs text-muted-fg">{hint}</p>}
      {children}
    </details>
  );
}
