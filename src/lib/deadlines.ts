/**
 * Client-safe deadline helper. Kept out of component bodies so the
 * react-hooks purity lint doesn't flag the `Date.now()` call, and so the
 * "has it expired?" rule lives in exactly one place.
 *
 * Once an allocation's use-by deadline has passed, its unused hours are
 * forfeited and no new sessions may be logged against it.
 */
export function deadlinePassed(deadline: Date): boolean {
  return deadline.getTime() < Date.now();
}
