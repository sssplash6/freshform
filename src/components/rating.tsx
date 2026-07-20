/** Read-only star rating (filled accent stars out of 5). */
export function Rating({ value }: { value: number }) {
  return (
    <span
      className="tabular-nums text-accent"
      aria-label={`${value} out of 5 stars`}
    >
      {"★".repeat(value)}
      <span className="text-line">{"★".repeat(5 - value)}</span>
    </span>
  );
}

/** Average helper for feedback lists. */
export function average(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}
