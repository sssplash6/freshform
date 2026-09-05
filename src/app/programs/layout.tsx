import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/dal";

// Authenticated, per-user pages that read the database on every request.
// Never prerender them at build time — on Render the SQLite disk only exists
// at runtime, so build-time DB access would fail.
export const dynamic = "force-dynamic";

/**
 * A program is an entity, not a silo (§4.3), so it gets the ordinary shell and
 * the reader's own nav — a scoped admin sees their program's name in the rail
 * where a platform admin sees "Programs", and neither is switched to a
 * different chrome for the length of this route.
 *
 * The gate is on each PAGE and not here. Next renders a layout and its page in
 * parallel, so a redirect thrown here does not stop the page from running its
 * queries and streaming the result — the defect that leaked the student roster
 * to any request carrying a cookie until Sep 3 2026 (`lib/dal.ts:33-43`).
 */
export default async function ProgramsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
