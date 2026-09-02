"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CheckIcon } from "@/components/icons";
import { ROLES, type Role } from "@/lib/constants";

const ITEMS = [
  { role: ROLES.ADMIN, home: "/admin", label: "Admin" },
  { role: ROLES.MENTOR, home: "/mentor", label: "Mentor" },
] as const;

/**
 * Where the other profile's version of THIS page lives, or null when there is
 * none and the role's home is the honest answer. Switching profile shouldn't
 * cost you your place: an admin who is also a mentor, standing on a student,
 * is nearly always switching in order to keep looking at that same student.
 *
 * Only pages that exist under both roles map, and the student page maps only
 * toward admin, because that is the direction that always opens — an admin may
 * open any student, where a student's MENTOR page depends on the viewer's
 * hours, sessions and programs. That answer isn't knowable from a path, so the
 * admin student page offers the jump back itself, where it is.
 */
function counterpart(pathname: string, to: Role): string | null {
  const student = pathname.match(/^\/mentor\/students\/([^/]+)$/);
  if (to === ROLES.ADMIN && student) return `/admin/students/${student[1]}`;
  if (to === ROLES.ADMIN && pathname === "/mentor/feedback") {
    return "/admin/feedback";
  }
  if (to === ROLES.MENTOR && pathname === "/admin/feedback") {
    return "/mentor/feedback";
  }
  return null;
}

/** Two segments, the active one filled. Dual-role admins only. */
export function ProfileSwitch({ active }: { active: Role }) {
  const pathname = usePathname();
  return (
    <div
      role="group"
      aria-label="Switch profile"
      className="flex items-center gap-0.5 rounded-lg border border-line bg-canvas p-0.5"
    >
      {ITEMS.map((it) =>
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
            href={counterpart(pathname, it.role) ?? it.home}
            className="rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-fg transition-colors hover:text-ink"
          >
            {it.label}
          </Link>
        )
      )}
    </div>
  );
}

/**
 * The same switch as a pair of menu rows. On a 320px header there is no room
 * for branding, a two-segment switch, a bell and a menu button at once — and
 * the switch is the one of the four that can live inside the menu without being
 * any harder to find.
 */
export function ProfileSwitchMenu({ active }: { active: Role }) {
  const pathname = usePathname();
  return (
    <div className="border-b border-line pb-1" role="group" aria-label="Switch profile">
      <p className="px-3 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-fg">
        Profile
      </p>
      {ITEMS.map((it) =>
        it.role === active ? (
          <span
            key={it.role}
            aria-current="true"
            className="flex min-h-11 items-center justify-between rounded-lg bg-brand-soft px-3 text-sm font-medium text-brand"
          >
            {it.label}
            <CheckIcon className="h-4 w-4" />
          </span>
        ) : (
          <Link
            key={it.role}
            href={counterpart(pathname, it.role) ?? it.home}
            className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-fg transition-colors hover:bg-canvas hover:text-ink"
          >
            {it.label}
          </Link>
        )
      )}
    </div>
  );
}
