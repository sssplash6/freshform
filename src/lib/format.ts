/** Client-safe formatting helpers. */

/** 1.5 → "1.5", 2 → "2", 0.333333 → "0.33" (hours are any-decimal floats). */
export function formatHours(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/** Session dates render as calendar dates (stored at UTC midnight). */
export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
