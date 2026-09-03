// Authenticated, per-user pages that read the database on every request.
// Never prerender them at build time — on Render the SQLite disk only exists
// at runtime, so build-time DB access would fail.
export const dynamic = "force-dynamic";

/**
 * No shell here on purpose: `/students/[id]` only redirects, so wrapping it in
 * an AppShell would render a full chrome the reader never sees. Phase 6 gives
 * this route a real page and its own shell.
 */
export default function StudentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
