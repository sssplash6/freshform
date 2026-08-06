"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

export type ProgramTab = { href: string; label: string; count?: number };

/**
 * The program's three rooms: what it looks like, who is in it, how it is set up.
 * A segmented control rather than a second row of underlined links, so it reads
 * as navigation INSIDE this page and never competes with the app's own nav bar
 * above it.
 *
 * Longest matching href wins, the same rule the app nav uses, so a deeper page
 * under a tab keeps that tab lit instead of falling back to Overview.
 */
export function ProgramTabs({ tabs }: { tabs: ProgramTab[] }) {
  const pathname = usePathname();
  const current = tabs.reduce<ProgramTab | null>((best, tab) => {
    const matches = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
    if (!matches) return best;
    if (!best || tab.href.length > best.href.length) return tab;
    return best;
  }, null);

  return (
    <nav
      aria-label="Program sections"
      // Hugs its three tabs on a real screen; stretches to fill the row at phone
      // widths, where a control floating in a wide empty bar reads as unfinished.
      className="flex w-full gap-1 rounded-xl border border-line bg-canvas p-1 sm:w-fit"
    >
      {tabs.map((tab) => {
        const active = tab === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              // flex-1 at phone widths so three tabs fill the row evenly; they
              // shrink back to their labels once there is room.
              "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm transition-colors sm:flex-none",
              active
                ? "bg-surface font-semibold text-ink shadow-sm"
                : "font-medium text-muted-fg hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  active
                    ? "bg-accent-soft text-accent-ink"
                    : "bg-line/70 text-muted-fg",
                )}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
