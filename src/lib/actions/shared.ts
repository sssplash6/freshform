/**
 * Shared result shape for form server actions driven by useActionState.
 * `null` is the initial state before any submission.
 */
export type ActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string }
  | null;

/** Parse a decimal-hours form field. Returns an error string or the value. */
export function parseHoursField(
  raw: FormDataEntryValue | null,
  { min, label }: { min: number; label: string }
): { value: number } | { error: string } {
  const n = Number.parseFloat(String(raw ?? "").trim());
  if (!Number.isFinite(n)) return { error: `${label} must be a number.` };
  if (n < min) return { error: `${label} must be at least ${min}.` };
  if (n > 10000) return { error: `${label} is implausibly large.` };
  // Avoid float noise like 0.30000000000000004 accumulating in sums.
  return { value: Number(n.toFixed(2)) };
}

/** Parse a required YYYY-MM-DD date field to a UTC-midnight Date. */
export function parseDateField(
  raw: FormDataEntryValue | null
): { value: Date } | { error: string } {
  const s = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { error: "Pick a valid date." };
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return { error: "Pick a valid date." };
  return { value: d };
}

/**
 * Parse an OPTIONAL wall-clock time ("14:30") onto a UTC-midnight date. Blank
 * means "no time given", which is a real answer — a mentor may know the day
 * before they know the hour — so it yields the date untouched.
 *
 * Deliberately NOT timezone-converted: the hour is stored exactly as typed so
 * that the student reads back the hour the mentor meant (see the Interview
 * model).
 */
export function parseTimeOnto(
  date: Date,
  raw: FormDataEntryValue | null
): { value: Date; hasTime: boolean } | { error: string } {
  const s = String(raw ?? "").trim();
  if (!s) return { value: date, hasTime: false };
  const match = /^(\d{2}):(\d{2})$/.exec(s);
  if (!match) return { error: "Pick a valid time, or leave it blank." };
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return { error: "Pick a valid time, or leave it blank." };
  }
  const withTime = new Date(date.getTime());
  withTime.setUTCHours(hours, minutes, 0, 0);
  return { value: withTime, hasTime: true };
}

/**
 * Parse an OPTIONAL link field (e.g. a student's file on Google Drive). Blank
 * means "no link" and yields null. A bare host like `drive.google.com/…` is
 * accepted and https-prefixed, since that's how links get pasted; anything
 * that isn't http(s) is rejected so only openable links are ever stored.
 */
export function parseLinkField(
  raw: FormDataEntryValue | null,
  label: string
): { value: string | null } | { error: string } {
  const s = String(raw ?? "").trim();
  if (!s) return { value: null };
  // Only prefix when no scheme is present at all — never rewrite `ftp:`/`javascript:`
  // into something that would sneak past the protocol check below.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { error: `${label} must be a valid link.` };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { error: `${label} must be an http or https link.` };
  }
  return { value: url.toString() };
}

export function normalizeEmail(raw: FormDataEntryValue | null): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
