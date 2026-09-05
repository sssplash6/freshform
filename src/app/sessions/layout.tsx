import { AppShell } from "@/components/app-shell";
import { requireMentorAccess } from "@/lib/dal";

// Authenticated, per-user pages that read the database on every request.
// Never prerender them at build time — on Render the SQLite disk only exists
// at runtime, so build-time DB access would fail.
export const dynamic = "force-dynamic";

/**
 * The first route outside `/admin`, `/mentor` and `/student`.
 *
 * Logging a session is a mentor's act whoever performs it, so
 * `requireMentorAccess` is the honest gate — it is exactly who `logSession`
 * will accept. What the shell shows is not this route's business: the nav
 * follows the reader's lens, so an admin who came here from their admin lens
 * keeps the admin rail and does not have their chrome swapped out under them
 * for the length of one form. Phase 6 gives this route the `/sessions` list
 * beside it.
 */
export default async function SessionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireMentorAccess();
  return <AppShell user={user}>{children}</AppShell>;
}
