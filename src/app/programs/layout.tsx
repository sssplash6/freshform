// Authenticated, per-user pages that read the database on every request.
// Never prerender them at build time — on Render the SQLite disk only exists
// at runtime, so build-time DB access would fail.
export const dynamic = "force-dynamic";

/** No shell: this route only redirects. Phase 6 gives it a real page. */
export default function ProgramsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
