import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/dal";

// Authenticated, per-user pages that read the database on every request.
// Never prerender them at build time — on Render the SQLite disk only exists
// at runtime, so build-time DB access would fail.
export const dynamic = "force-dynamic";

/**
 * The roster and the mentor pages under it.
 *
 * A mentor page is read by every role — the mentor themself, an admin who
 * administers a program they work in, a colleague, a student deciding whether
 * to book — so the shell takes the VIEWER's own nav: a student keeps their
 * student navigation, and a dual-role admin keeps whichever lens they are in
 * rather than the one their `role` column names.
 *
 * The gate is on each PAGE, not here. Next renders a layout and its page in
 * PARALLEL, so a redirect thrown here does not stop the page from running its
 * queries and streaming the result — which on Sep 3 2026 was a live leak of the
 * whole student roster to any request carrying a junk session cookie.
 */
export default async function MentorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
