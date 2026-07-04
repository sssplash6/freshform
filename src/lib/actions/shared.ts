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

export function normalizeEmail(raw: FormDataEntryValue | null): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
