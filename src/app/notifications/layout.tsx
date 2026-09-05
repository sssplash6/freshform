import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/dal";

// Authenticated, per-user pages that read the database on every request.
// Never prerender them at build time — on Render the SQLite disk only exists
// at runtime, so build-time DB access would fail.
export const dynamic = "force-dynamic";

/**
 * The feed is read by every role, so the shell takes the viewer's own nav. It
 * used to fall back to `user.role` when no mode was passed, which showed a
 * dual-role admin the admin rail whichever lens they were working in; the shell
 * reads the lens cookie itself now, so there is nothing left here to get wrong.
 */
export default async function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
