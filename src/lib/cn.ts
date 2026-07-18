/** Join class names, keeping only non-empty strings. Small and
 * dependency-free — our usage is additive (base classes + optional
 * overrides), so we don't need conflict-resolution like tailwind-merge.
 * Accepts `unknown` so `cond && "class"` expressions (where `cond` may be a
 * number or ReactNode) pass through cleanly. */
export function cn(...classes: unknown[]): string {
  return classes.filter((c): c is string => typeof c === "string" && c.length > 0).join(" ");
}
