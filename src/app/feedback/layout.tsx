import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/dal";

// Authenticated, per-user pages that read the database on every request.
// Never prerender them at build time — on Render the SQLite disk only exists
// at runtime, so build-time DB access would fail.
export const dynamic = "force-dynamic";

/**
 * One address for every rating in the product, replacing /admin/feedback and
 * /mentor/feedback.
 *
 * The shell takes the viewer, not a role: it reads the lens cookie itself, so
 * a dual-role admin who arrived from the admin rail keeps the admin rail and a
 * mentor keeps theirs. The gate is in the page rather than here, because Next
 * renders a layout and its page in PARALLEL — a redirect thrown here alone does
 * not stop the page running its queries (the incident is written up on
 * `requireRole` in dal.ts).
 */
export default async function FeedbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
