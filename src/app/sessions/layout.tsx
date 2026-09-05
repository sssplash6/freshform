import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/dal";

// Authenticated, per-user pages that read the database on every request.
// Never prerender them at build time — on Render the SQLite disk only exists
// at runtime, so build-time DB access would fail.
export const dynamic = "force-dynamic";

/**
 * The ledger and the form that adds to it.
 *
 * The gate widened when the list arrived beside the form. Logging is a
 * mentor's act whoever performs it, and `/sessions/new` still says so for
 * itself; READING the ledger is also an admin's job, and most admins here do
 * not mentor. So the layout asks only for a signed-in reader and each page
 * gates on what it actually needs — which is the rule for every page anyway,
 * since Next renders a layout and its page in parallel.
 *
 * What the shell shows is not this route's business: the nav follows the
 * reader's lens, so an admin who came from their admin lens keeps the admin
 * rail and does not have their chrome swapped out for the length of one form.
 */
export default async function SessionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
