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
  /** Ring colour, so a PHOTO can still carry the person's identity hue. */
  ring: string;
};

const TONES: PersonTone[] = [
  {
    chip: "bg-tone-violet-soft text-tone-violet-ink",
    badge: "bg-tone-violet-dot",
    ink: "text-tone-violet-ink",
    ring: "ring-tone-violet-dot",
  },
  {
    chip: "bg-tone-teal-soft text-tone-teal-ink",
    badge: "bg-tone-teal-dot",
    ink: "text-tone-teal-ink",
    ring: "ring-tone-teal-dot",
  },
  {
    chip: "bg-tone-amber-soft text-tone-amber-ink",
    badge: "bg-tone-amber-dot",
    ink: "text-tone-amber-ink",
    ring: "ring-tone-amber-dot",
  },
  {
    chip: "bg-tone-rose-soft text-tone-rose-ink",
    badge: "bg-tone-rose-dot",
    ink: "text-tone-rose-ink",
    ring: "ring-tone-rose-dot",
  },
  {
    chip: "bg-tone-indigo-soft text-tone-indigo-ink",
    badge: "bg-tone-indigo-dot",
    ink: "text-tone-indigo-ink",
    ring: "ring-tone-indigo-dot",
  },
  {
    chip: "bg-tone-lime-soft text-tone-lime-ink",
    badge: "bg-tone-lime-dot",
    ink: "text-tone-lime-ink",
    ring: "ring-tone-lime-dot",
  },
  {
    chip: "bg-tone-cyan-soft text-tone-cyan-ink",
    badge: "bg-tone-cyan-dot",
    ink: "text-tone-cyan-ink",
    ring: "ring-tone-cyan-dot",
  },
  {
    chip: "bg-tone-plum-soft text-tone-plum-ink",
    badge: "bg-tone-plum-dot",
    ink: "text-tone-plum-ink",
    ring: "ring-tone-plum-dot",
  },
];

/** FNV-1a, for a well-spread index off ids that share long prefixes (cuid). */
function hashIndex(id: string, buckets: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash) % buckets;
}

export function personTone(id: string): PersonTone {
  return TONES[hashIndex(id, TONES.length)];
}

/**
 * The same eight hues, expressed as a banner treatment, so each program's page
 * and card read as its own place instead of three identical blue headers.
 *
 * Keyed off the program's POSITION in creation order, not a hash of its id:
 * hashing three programs into eight buckets collides about a third of the time,
 * and two programs sharing a color is exactly what this exists to prevent. By
 * position the first eight are guaranteed distinct, and a program's color never
 * moves as long as nothing created before it is deleted.
 */
export type ProgramTone = {
  /** Gradient wash for a banner body. */
  wash: string;
  /** The hairline across the top of a banner or card. */
  rule: string;
  /** Small-caps eyebrow text. */
  eyebrow: string;
  /** Border + background for a hovered card. */
  cardHover: string;
};

const PROGRAM_TONES: ProgramTone[] = [
  {
    wash: "from-tone-violet-soft to-surface",
    rule: "bg-tone-violet-dot",
    eyebrow: "text-tone-violet-ink",
    cardHover: "hover:border-tone-violet-dot/60",
  },
  {
    wash: "from-tone-teal-soft to-surface",
    rule: "bg-tone-teal-dot",
    eyebrow: "text-tone-teal-ink",
    cardHover: "hover:border-tone-teal-dot/60",
  },
  {
    wash: "from-tone-amber-soft to-surface",
    rule: "bg-tone-amber-dot",
    eyebrow: "text-tone-amber-ink",
    cardHover: "hover:border-tone-amber-dot/60",
  },
  {
    wash: "from-tone-rose-soft to-surface",
    rule: "bg-tone-rose-dot",
    eyebrow: "text-tone-rose-ink",
    cardHover: "hover:border-tone-rose-dot/60",
  },
  {
    wash: "from-tone-indigo-soft to-surface",
    rule: "bg-tone-indigo-dot",
    eyebrow: "text-tone-indigo-ink",
    cardHover: "hover:border-tone-indigo-dot/60",
  },
  {
    wash: "from-tone-lime-soft to-surface",
    rule: "bg-tone-lime-dot",
    eyebrow: "text-tone-lime-ink",
    cardHover: "hover:border-tone-lime-dot/60",
  },
  {
    wash: "from-tone-cyan-soft to-surface",
    rule: "bg-tone-cyan-dot",
    eyebrow: "text-tone-cyan-ink",
    cardHover: "hover:border-tone-cyan-dot/60",
  },
  {
    wash: "from-tone-plum-soft to-surface",
    rule: "bg-tone-plum-dot",
    eyebrow: "text-tone-plum-ink",
    cardHover: "hover:border-tone-plum-dot/60",
  },
];

export function programTone(position: number): ProgramTone {
  const i = Number.isFinite(position) && position >= 0 ? Math.floor(position) : 0;
  return PROGRAM_TONES[i % PROGRAM_TONES.length];
}

/**
 * One person's own hue as a banner treatment, so a mentor's page opens in the
 * colour their chip already carries in every table — you recognise whose page
 * it is before reading the name.
 *
 * PROGRAM_TONES lists the same eight hues in the same order as TONES, so
 * hashing an id through either lands on the same colour. Keep them in step.
 */
export function personBanner(id: string): ProgramTone {
  return PROGRAM_TONES[hashIndex(id, PROGRAM_TONES.length)];
}

/** How many hues exist before they repeat — handy in tests and docs. */
export const PROGRAM_TONE_COUNT = PROGRAM_TONES.length;

/**
 * Up to two letters standing in for a name: first and last word, so
 * "Global Admissions Program" reads GP and "Master's Program" MP.
 */
export function monogramOf(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Up to two initials: "Sharofiddin Aliyev" → "SA", "Valera" → "VA". Falls back
 * to the email's first letters so a mentor who hasn't set a name still gets a
 * badge rather than an empty circle.
 */
export function initials(name: string | null, email: string): string {
  return monogramOf(name?.trim() || email.split("@")[0].replace(/[._-]+/g, " "));
}
