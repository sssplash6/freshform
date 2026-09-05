import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/dal";

// Authenticated, per-user pages that read the database on every request.
// Never prerender them at build time — on Render the SQLite disk only exists
// at runtime, so build-time DB access would fail.
export const dynamic = "force-dynamic";

/**
 * The ordinary shell, which is what makes this page nav-less.
 *
 * `AppShell` decides the chrome from the reader, not from the route: everybody
 * with a branch on the page below satisfies its `settlingIn` test — PENDING,
 * UNASSIGNED, a mentor with no name, a student with no Telegram handle — so
 * every one of them gets `PublicShell`, a wordmark and a way out. Rebuilding
 * that decision here would be a second copy of it, and the two would disagree
 * the first time either moved; the pair that used to disagree were the two
 * onboarding gates and the shell that wrapped them.
 *
 * The gate is on the PAGE, not here. Next renders a layout and its page in
 * parallel, so a redirect thrown here would not stop the page from running.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
