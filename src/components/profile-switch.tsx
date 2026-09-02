"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { CheckIcon } from "@/components/icons";
import { ROLES, type Role } from "@/lib/constants";

const ITEMS = [
  { role: ROLES.ADMIN, home: "/admin", label: "Admin" },
  { role: ROLES.MENTOR, home: "/mentor", label: "Mentor" },
] as const;

/** The profile that isn't the one you're in. There are only ever two. */
function other(active: Role): (typeof ITEMS)[number] {
  return ITEMS.find((it) => it.role !== active) ?? ITEMS[0];
}

/**
 * Alt+M, and ⌥M on a Mac — "M for mode". Chosen because it is free in every
 * major browser on both platforms: ⌘L/Ctrl+L, the obvious pick, is the address
 * bar and is reserved, so a page cannot have it.
 *
 * Rendered as a tooltip rather than visible text: the header already carries a
 * brand, a switch, a bell and a menu at 320px.
 */
function useShortcutLabel(): string {
  // The platform is an external, never-changing fact, and the server can't see
  // it — so the server renders the plain form and the client swaps in ⌥ during
  // hydration. useSyncExternalStore is what gives those two different answers
  // without it counting as a hydration mismatch.
  return useSyncExternalStore(
    subscribeToNothing,
    () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌥M" : "Alt+M"),
    () => "Alt+M"
  );
}

/** A store that never emits: the keyboard's labels don't change mid-session. */
function subscribeToNothing(): () => void {
  return () => {};
}

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

/**
 * The keyboard half of the switch: Alt+M / ⌥M anywhere in the app. Renders
 * nothing, and the shell mounts exactly one of it — both switches are in the
 * DOM at once (one hidden by a breakpoint), so hanging the listener off either
 * would fire it twice.
 *
 * It prefers the counterpart link the PAGE marked, when there is one, because
 * that is the only thing that knows whether a student's mentor view opens for
 * this viewer. Failing that it falls back to the path mapping, then to the
 * other profile's home — so the key always goes somewhere real.
 */
export function ProfileShortcut({ active }: { active: Role }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const target = other(active);
    function onKeyDown(e: KeyboardEvent) {
      // Alt alone: ⌥⌘M and ⌥⇧M belong to other things, here and in the OS.
      if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      // ⌥M types "µ" on a Mac, so the key that arrives isn't "m" — the physical
      // key is what identifies the chord.
      if (e.code !== "KeyM") return;
      // Never while someone is writing a note or a student's name — and never
      // steal the µ they meant to type.
      const el = document.activeElement;
      if (
        el instanceof HTMLElement &&
        (el.isContentEditable ||
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT")
      ) {
        return;
      }
      const marked = document
        .querySelector("[data-profile-counterpart] a[href]")
        ?.getAttribute("href");
      const href =
        (marked?.startsWith(target.home) ? marked : null) ??
        counterpart(pathname, target.role) ??
        target.home;
      e.preventDefault();
      router.push(href);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, pathname, router]);

  return null;
}

/** Two segments, the active one filled. Dual-role admins only. */
export function ProfileSwitch({ active }: { active: Role }) {
  const pathname = usePathname();
  const shortcut = useShortcutLabel();
  return (
    <div
      role="group"
      aria-label="Switch profile"
      aria-keyshortcuts="Alt+M"
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
            title={`Switch profile (${shortcut})`}
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
  const shortcut = useShortcutLabel();
  return (
    <div
      className="border-b border-line pb-1"
      role="group"
      aria-label="Switch profile"
      aria-keyshortcuts="Alt+M"
    >
      <p className="flex items-baseline justify-between gap-2 px-3 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-fg">
        Profile
        <span className="font-semibold normal-case tracking-normal">
          {shortcut}
        </span>
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
