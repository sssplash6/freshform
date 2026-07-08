"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavItem } from "@/lib/nav";

/** Role nav with the current page marked; longest matching href wins so
 * /admin/students/[id] highlights Students, not Dashboard. */
export function NavLinks({ items }: { items: NavItem[] }) {
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
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 pb-0.5 transition-colors ${
              active
                ? "border-brand text-white"
                : "border-transparent text-white/80 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
