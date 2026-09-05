import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/dal";

// Authenticated, per-user pages that read the database on every request.
// Never prerender them at build time — on Render the SQLite disk only exists
// at runtime, so build-time DB access would fail.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The inbox under this shell is where an admin with no grants lands and is
  // told so, which a gate demanding a grant would make unreachable.
  const user = await requireStaff();
  return <AppShell user={user}>{children}</AppShell>;
}
