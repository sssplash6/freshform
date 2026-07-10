import Link from "next/link";

import { NavLinks } from "@/components/nav-links";
import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NAV_BY_ROLE, ROLE_LABELS } from "@/lib/nav";
import type { Role } from "@/lib/constants";
import type { User } from "@/generated/prisma/client";

/**
 * Shared chrome for every signed-in role: brand header, role-specific nav,
 * notification bell, user identity, sign-out. Pages render inside.
 */
export async function AppShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const role = user.role as Role;
  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, read: false },
  });

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-mist bg-navy text-white">
        <div className="mx-auto hidden min-h-16 max-w-6xl items-center gap-8 px-4 md:flex">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight">
              Freshman Academy
            </span>
            <span className="rounded bg-brand px-1.5 py-0.5 text-xs font-semibold text-white">
              {ROLE_LABELS[role]}
            </span>
          </Link>

          <nav className="flex flex-1 items-center gap-5 text-[15px]">
            <NavLinks items={NAV_BY_ROLE[role]} />
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/notifications"
              aria-label={`Notifications (${unreadCount} unread)`}
              className="relative flex h-11 w-11 items-center justify-center rounded text-white/80 transition-colors hover:text-white"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
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
                className="min-h-11 rounded border border-white/30 px-2.5 py-1 text-xs text-white/80 transition-colors hover:border-white/60 hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 md:hidden">
          <Link href="/" className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-lg font-bold tracking-tight">
              Freshman Academy
            </span>
            <span className="shrink-0 rounded bg-brand px-1.5 py-0.5 text-xs font-semibold text-white">
              {ROLE_LABELS[role]}
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1">
            <Link
              href="/notifications"
              aria-label={`Notifications (${unreadCount} unread)`}
              className="relative flex h-11 w-11 items-center justify-center rounded text-white/80 transition-colors hover:text-white"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            <details className="group relative">
              <summary className="flex h-11 cursor-pointer list-none items-center rounded px-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white [&::-webkit-details-marker]:hidden">
                Menu
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-white/15 bg-navy p-2 shadow-lg">
                <nav aria-label="Primary navigation" className="grid gap-1">
                  <NavLinks items={NAV_BY_ROLE[role]} variant="menu" />
                </nav>
                <div className="mt-2 border-t border-white/15 pt-2">
                  <p className="px-3 pb-2 text-xs text-white/65">
                    {user.name ?? user.email}
                  </p>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/login" });
                    }}
                  >
                    <button
                      type="submit"
                      className="flex min-h-11 w-full items-center rounded px-3 text-left text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
