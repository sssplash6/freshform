import Link from "next/link";

import { signOut } from "@/lib/auth";
import type { User } from "@/generated/prisma/client";

export type NavItem = { href: string; label: string };

/**
 * Shared chrome for every signed-in role: brand header, role-specific nav,
 * user identity, sign-out. Pages render inside.
 */
export function AppShell({
  user,
  roleLabel,
  nav,
  children,
}: {
  user: User;
  roleLabel: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-mist bg-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-lg font-semibold">Freshman Academy</span>
            <span className="rounded bg-brand px-1.5 py-0.5 text-xs font-medium text-white">
              {roleLabel}
            </span>
          </Link>

          <nav className="flex flex-1 items-center gap-4 text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-white/80 transition-colors hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-white/70 sm:inline">
              {user.name ?? user.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded border border-white/30 px-2.5 py-1 text-xs text-white/80 transition-colors hover:border-white/60 hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
