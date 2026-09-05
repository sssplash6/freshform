import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/dal";

// Authenticated, per-user pages that read the database on every request.
// Never prerender them at build time — on Render the SQLite disk only exists
// at runtime, so build-time DB access would fail.
export const dynamic = "force-dynamic";

/**
 * Everyone has settings, so the only gate is being signed in. What each page
 * under here shows is decided by what the reader actually has — a student sees
 * no booking links, a mentor no Telegram row — not by their role.
 */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
