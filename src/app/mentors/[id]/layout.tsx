import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/dal";

// Authenticated, per-user pages that read the database on every request.
// Never prerender them at build time — on Render the SQLite disk only exists
// at runtime, so build-time DB access would fail.
export const dynamic = "force-dynamic";

/**
 * Mentor profiles are one page read by every role, so the shell takes the
 * VIEWER's own nav (like /notifications) rather than a role-specific one: a
 * student reading a mentor's profile keeps their student navigation.
 */
export default async function MentorProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
