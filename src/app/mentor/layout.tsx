import { AppShell } from "@/components/app-shell";
import { requireMentorAccess } from "@/lib/dal";

// Authenticated, per-user pages that read the database on every request.
// Never prerender them at build time — on Render the SQLite disk only exists
// at runtime, so build-time DB access would fail.
export const dynamic = "force-dynamic";

export default async function MentorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireMentorAccess();
  return <AppShell user={user}>{children}</AppShell>;
}
