/**
 * A stable identity color per person, so the same mentor is the same color in
 * every table on every page. Derived from their id rather than stored: nobody
 * has to pick colors, and a mentor added today looks the same tomorrow.
 *
 * Class strings are written out in full because Tailwind only generates
 * utilities it can see in source — a template like `bg-tone-${hue}-soft` would
 * compile to nothing.
 */

export type PersonTone = {
  /** Tinted background + matching text, for the chip body. */
  chip: string;
  /** Saturated fill for the initials badge (white text sits on it). */
  badge: string;
  /** Same hue as text alone, for use on an untinted surface. */
  ink: string;
};

const TONES: PersonTone[] = [
  {
    chip: "bg-tone-violet-soft text-tone-violet-ink",
    badge: "bg-tone-violet-dot",
    ink: "text-tone-violet-ink",
  },
  {
    chip: "bg-tone-teal-soft text-tone-teal-ink",
    badge: "bg-tone-teal-dot",
    ink: "text-tone-teal-ink",
  },
  {
    chip: "bg-tone-amber-soft text-tone-amber-ink",
    badge: "bg-tone-amber-dot",
    ink: "text-tone-amber-ink",
  },
  {
    chip: "bg-tone-rose-soft text-tone-rose-ink",
    badge: "bg-tone-rose-dot",
    ink: "text-tone-rose-ink",
  },
  {
    chip: "bg-tone-indigo-soft text-tone-indigo-ink",
    badge: "bg-tone-indigo-dot",
    ink: "text-tone-indigo-ink",
  },
  {
    chip: "bg-tone-lime-soft text-tone-lime-ink",
    badge: "bg-tone-lime-dot",
    ink: "text-tone-lime-ink",
  },
  {
    chip: "bg-tone-cyan-soft text-tone-cyan-ink",
    badge: "bg-tone-cyan-dot",
    ink: "text-tone-cyan-ink",
  },
  {
    chip: "bg-tone-plum-soft text-tone-plum-ink",
    badge: "bg-tone-plum-dot",
    ink: "text-tone-plum-ink",
  },
];

/** FNV-1a, for a well-spread index off ids that share long prefixes (cuid). */
export function personTone(id: string): PersonTone {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return TONES[Math.abs(hash) % TONES.length];
}

/**
 * Up to two initials: "Sharofiddin Aliyev" → "SA", "Valera" → "VA". Falls back
 * to the email's first letters so a mentor who hasn't set a name still gets a
 * badge rather than an empty circle.
 */
export function initials(name: string | null, email: string): string {
  const source = name?.trim() || email.split("@")[0].replace(/[._-]+/g, " ");
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
