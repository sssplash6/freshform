/** Client-safe formatting helpers. */

/** 1.5 → "1.5", 2 → "2", 0.333333 → "0.33" (hours are any-decimal floats). */
export function formatHours(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/** Money in US dollars: 1200 → "$1,200", 1200.5 → "$1,200.50". */
export function formatMoney(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** Session dates render as calendar dates (stored at UTC midnight). */
export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Timestamps (notifications, audit entries): "8 Jul 2026, 14:32 UTC". */
export function formatDateTime(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}
