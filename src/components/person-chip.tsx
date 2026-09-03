import Link from "next/link";

import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/cn";
import { personTone } from "@/lib/person-tone";

/**
 * `avatarUpdatedAt` is optional so the many call sites that `select` only
 * id/name/email still typecheck — they simply render initials, as before.
 */
type Person = {
  id: string;
  name: string | null;
  email: string;
  avatarUpdatedAt?: Date | null;
};

/**
 * A person as a colored chip with their initials — the "Team" and "Mentor"
 * cells of the ledger. Everyone keeps one color across the whole app, so a
 * column of sessions can be read by who ran them without reading any names.
 * Once someone sets a profile picture it replaces the initials here.
 *
 * `size="sm"` is the in-table size; the default suits a page header. Passing
 * `href` turns the chip into a link (admins click a mentor through to their
 * page); the hover ring picks up the chip's own hue via `ring-current`, so one
 * rule covers all eight tones.
 */
export function PersonChip({
  person,
  size = "md",
  href,
  className,
}: {
  person: Person;
  size?: "sm" | "md";
  href?: string;
  className?: string;
}) {
  const tone = personTone(person.id);
  const label = person.name ?? person.email;
  const sm = size === "sm";

  const classes = cn(
    "inline-flex max-w-full items-center rounded-full font-medium",
    tone.chip,
    sm ? "gap-1.5 py-0.5 pl-0.5 pr-2.5 text-xs" : "gap-2 py-1 pl-1 pr-3.5 text-sm",
    href &&
      "ring-1 ring-transparent transition-shadow hover:ring-current focus-visible:ring-current",
    className,
  );
  const title = person.name
    ? `${person.name} · ${person.email}`
    : person.email;

  const body = (
    <>
      {/* `sm` stays small: it sits in the dense ledger tables, where the name
          beside it does the identifying and row height is the scarce resource.
          `md` is the header/card size and has room for a face. */}
      <Avatar
        person={person}
        className={sm ? "h-5 w-5 text-[9px]" : "h-8 w-8 text-[11px]"}
      />
      <span className="min-w-0 truncate">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} title={title} className={classes}>
        {body}
      </Link>
    );
  }

  return (
    <span title={title} className={classes}>
      {body}
    </span>
  );
}

/**
 * The initials badge on its own, for tight spots (a stack of mentors on one
 * row) where the full chip would not fit. Name stays available on hover.
 */
export function PersonBadge({
  person,
  className,
}: {
  person: Person;
  className?: string;
}) {
  return (
    <Avatar
      person={person}
      title={person.name ?? person.email}
      className={cn("h-6 w-6 text-[10px] ring-2 ring-surface", className)}
    />
  );
}
