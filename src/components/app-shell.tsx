import Link from "next/link";

import { NavLinks } from "@/components/nav-links";
import { ChevronDownIcon, LogOutIcon } from "@/components/icons";
import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NAV_BY_ROLE, ROLE_LABELS } from "@/lib/nav";
import { ROLES, type Role } from "@/lib/constants";
import type { User } from "@/generated/prisma/client";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

/**
 * Header switch for dual-role admins (admin + mentor): highlights the active
 * profile and links to the other one. Route-based — /admin* is admin view,
 * /mentor* is mentor view — so the layout passes which is active.
 */
function ProfileSwitch({ active }: { active: Role }) {
  const items = [
    { role: ROLES.ADMIN, label: "Admin", href: "/admin" },
    { role: ROLES.MENTOR, label: "Mentor", href: "/mentor" },
  ] as const;
  return (
    <div
      role="group"
      aria-label="Switch profile"
      className="flex items-center gap-0.5 rounded-lg border border-line bg-canvas p-0.5"
    >
      {items.map((it) =>
        it.role === active ? (
          <span
            key={it.role}
            aria-current="true"
            className="rounded-md bg-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white"
          >
            {it.label}
          </span>
        ) : (
          <Link
            key={it.role}
            href={it.href}
            className="rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-fg transition-colors hover:text-ink"
          >
            {it.label}
          </Link>
        )
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
      {ROLE_LABELS[role]}
    </span>
  );
}

function NotificationBell({ count }: { count: number }) {
  return (
    <Link
      href="/notifications"
      aria-label={`Notifications (${count} unread)`}
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-fg transition-colors hover:bg-canvas hover:text-ink"
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
      {count > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

/**
 * Signed-in user cluster: an avatar-initial button that opens a small menu
 * with the account's name/email and a sign-out. Groups identity + sign-out
 * into one control instead of a loose label plus a bare button.
 */
function UserMenu({ user }: { user: User }) {
  const label = user.name ?? user.email;
  const initial = (user.name?.trim() || user.email).charAt(0).toUpperCase();
  return (
    <details className="group relative">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-full pl-1 pr-2.5 transition-colors hover:bg-canvas [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand"
        >
          {initial}
        </span>
        <span className="hidden max-w-36 truncate text-sm font-medium text-ink lg:inline">
          {label}
        </span>
        <ChevronDownIcon className="h-4 w-4 text-muted-fg transition-transform group-open:rotate-180" />
      </summary>
      <div className="pop-in absolute right-0 z-20 mt-1 w-60 rounded-xl border border-line bg-surface p-1 shadow-soft [--pop-origin:top_right]">
        <div className="border-b border-line px-3 py-2.5">
          <p className="truncate text-sm font-medium text-ink">
            {user.name ?? user.email}
          </p>
          {user.name && (
            <p className="truncate text-xs text-muted-fg">{user.email}</p>
          )}
        </div>
        <form action={signOutAction} className="pt-1">
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-muted-fg transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOutIcon className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

/**
 * Shared chrome for every signed-in role: a light nav bar in three groups —
 * brand + profile on the left, nav in the middle, notifications + account on
 * the right. `mode` overrides which role's nav shows (dual-role admins pass
 * it); it defaults to the user's own role. Pages render inside.
 */
export async function AppShell({
  user,
  mode,
  children,
}: {
  user: User;
  mode?: Role;
  children: React.ReactNode;
}) {
  const activeRole = (mode ?? (user.role as Role)) as Role;
  const isDual = user.role === ROLES.ADMIN && user.isMentor;
  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, read: false },
  });

  const brand = (
    <Link href="/" className="shrink-0 text-base font-bold tracking-tight text-brand">
      freshlog
    </Link>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        {/* Desktop */}
        <div className="mx-auto hidden min-h-16 max-w-5xl items-center gap-6 px-4 md:flex">
          <div className="flex items-center gap-2.5">
            {brand}
            {isDual ? <ProfileSwitch active={activeRole} /> : <RoleBadge role={activeRole} />}
          </div>

          <nav className="flex flex-1 items-center gap-1">
            <NavLinks items={NAV_BY_ROLE[activeRole]} />
          </nav>

          <div className="flex items-center gap-1 border-l border-line pl-3">
            <NotificationBell count={unreadCount} />
            <UserMenu user={user} />
          </div>
        </div>

        {/* Mobile */}
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3 px-4 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            {brand}
            {isDual ? <ProfileSwitch active={activeRole} /> : <RoleBadge role={activeRole} />}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell count={unreadCount} />
            <details className="group relative">
              <summary className="flex h-10 cursor-pointer list-none items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-muted-fg transition-colors hover:bg-canvas hover:text-ink [&::-webkit-details-marker]:hidden">
                Menu
                <ChevronDownIcon className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="pop-in absolute right-0 z-20 mt-1 w-60 rounded-xl border border-line bg-surface p-1 shadow-soft [--pop-origin:top_right]">
                <nav aria-label="Primary navigation" className="grid gap-1">
                  <NavLinks items={NAV_BY_ROLE[activeRole]} variant="menu" />
                </nav>
                <div className="mt-1 border-t border-line pt-1">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium text-ink">
                      {user.name ?? user.email}
                    </p>
                    {user.name && (
                      <p className="truncate text-xs text-muted-fg">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-muted-fg transition-colors hover:bg-red-50 hover:text-red-700"
                    >
                      <LogOutIcon className="h-4 w-4" />
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
