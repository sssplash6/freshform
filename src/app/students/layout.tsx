import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/dal";

// Authenticated, per-user pages that read the database on every request.
// Never prerender them at build time — on Render the SQLite disk only exists
// at runtime, so build-time DB access would fail.
export const dynamic = "force-dynamic";

/**
 * The roster and the workspace under it are read by admins, by mentors and by
 * the two at once, so the shell is the ordinary one and it decides the nav
 * from the reader's grants and lens. The gate is on each PAGE, not here: Next
 * renders a layout and its page in parallel, so a redirect thrown here does
 * not stop the page from running its queries.
 */
export default async function StudentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
