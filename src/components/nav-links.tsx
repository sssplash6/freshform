"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavItem } from "@/lib/nav";

/** Role nav with the current page marked; longest matching href wins so
 * /admin/students/[id] highlights Students, not Dashboard. */
export function NavLinks({
  items,
  variant = "header",
}: {
  items: NavItem[];
  variant?: "header" | "menu";
}) {
  const pathname = usePathname();
  const current = items.reduce<NavItem | null>((best, item) => {
    const matches =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!matches) return best;
    if (!best || item.href.length > best.href.length) return item;
    return best;
  }, null);

  return (
    <>
      {items.map((item) => {
        const active = item === current;
        const className =
          variant === "menu"
            ? `flex min-h-11 items-center rounded px-3 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-white"
                  : "text-white/85 hover:bg-white/10 hover:text-white"
              }`
            : `inline-flex min-h-11 items-center border-b-2 px-1 transition-colors ${
                active
                  ? "border-accent text-white"
                  : "border-transparent text-white/80 hover:text-white"
              }`;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={className}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
