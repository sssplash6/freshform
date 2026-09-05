"use client";

import Link from "next/link";

import { NavCount, useCurrentNavItem } from "@/components/nav-links";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/nav";

/**
 * The bottom bar below the sidebar's breakpoint.
 *
 * Visible, not hidden behind a word. What this replaces was a `<details>`
 * labelled "Menu" holding every destination in the app, and NN/g measured
 * hidden navigation at 27% use against 48–50% for visible — on the surface
 * where students and mentors actually are.
 *
 * Four slots, because five 64px targets do not fit a 320px screen with any
 * label left readable. A fifth item and beyond fold into "More", which is the
 * one disclosure kept: an admin lens carries six items and the alternative to a
 * sheet is a bar that scrolls sideways.
 */
const SLOTS = 4;

export function TabBar({
  items,
  className,
}: {
  items: NavItem[];
  className?: string;
}) {
  const current = useCurrentNavItem(items);
  const overflows = items.length > SLOTS;
  const shown = overflows ? items.slice(0, SLOTS - 1) : items;
  const rest = overflows ? items.slice(SLOTS - 1) : [];

  return (
    <nav
      aria-label="Primary"
      className={cn(
        // Above the page, and padded for the home indicator on a phone — a bar
        // flush to the bottom edge puts its last row of pixels under the
        // gesture area on every iPhone made since 2017.
        "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]",
        className
      )}
    >
      <ul className="mx-auto flex max-w-md">
        {shown.map((item) => {
          const active = item === current;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-xs transition-colors",
                  active ? "font-semibold text-brand" : "text-muted-fg"
                )}
              >
                <span className="min-w-0 text-center">{item.label}</span>
                {item.count != null && item.count > 0 && (
                  <NavCount count={item.count} />
                )}
              </Link>
            </li>
          );
        })}

        {rest.length > 0 && (
          <li className="min-w-0 flex-1">
            <Popover
              label="More"
              origin="end"
              width="sm"
              triggerClassName={cn(
                "flex min-h-14 w-full cursor-pointer flex-col items-center justify-center gap-1 px-1 text-xs transition-colors",
                current && rest.includes(current)
                  ? "font-semibold text-brand"
                  : "text-muted-fg"
              )}
              trigger={<span>More</span>}
            >
              {rest.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item === current ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors",
                    item === current
                      ? "bg-brand-soft font-semibold text-brand"
                      : "font-medium text-muted-fg hover:bg-canvas hover:text-ink"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </Popover>
          </li>
        )}
      </ul>
    </nav>
  );
}
