import { AppShell } from "@/components/app-shell";
import { ROLES } from "@/lib/constants";
import { requireMentorAccess } from "@/lib/dal";

// Authenticated, per-user pages that read the database on every request.
// Never prerender them at build time — on Render the SQLite disk only exists
// at runtime, so build-time DB access would fail.
export const dynamic = "force-dynamic";

/**
 * The first route outside `/admin`, `/mentor` and `/student`.
 *
 * Logging a session is a mentor's act whoever performs it, so the shell shows
 * the mentor nav — an admin who also mentors gets here from their mentor
 * lens. Phase 6 makes this route properly role-neutral and gives it the tabbed
 * `/sessions` list beside it; until then `requireMentorAccess` is the honest
 * gate, since it is exactly who `logSession` will accept.
 */
export default async function SessionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireMentorAccess();
  return (
    <AppShell user={user} mode={ROLES.MENTOR}>
      {children}
    </AppShell>
  );
}
