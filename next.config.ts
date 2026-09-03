import type { NextConfig } from "next";

/**
 * One old address and the role-neutral one that replaces it.
 *
 * `why` is the reason the pair exists at all, and it is required: a redirect
 * whose reason nobody can state is a redirect nobody dares delete, which is how
 * a temporary map becomes a second sitemap.
 */
type Move = { from: string; to: string; why: string };

/**
 * Old routes, kept alive while links to them are still in the wild.
 *
 * The reorganisation gives every entity one role-neutral address —
 * /admin/students/[id] and /mentor/students/[id] become /students/[id], the
 * /leader and /sales trees fold into /programs/[id] — and there are two kinds
 * of link that cannot be edited to match: bookmarks in ten people's browsers,
 * and the `href` already stored on hundreds of `Notification` rows.
 *
 * Stored hrefs are NEVER rewritten. A notification is a record of what was said
 * at the time, and a migration that edits its link edits history; /n/[id]
 * resolves an old row to wherever its subject lives now (`neutralHref` in
 * src/lib/notify.ts) instead. This map covers the bookmarks.
 *
 * A ROW MAY ONLY BE ADDED BY THE COMMIT THAT BUILDS ITS DESTINATION, and that
 * commit must also delete any seed page standing at the destination. Both
 * halves matter:
 *
 *   - /students/[id] and /programs/[id] exist today as SEEDS that redirect the
 *     other way, to whichever role-scoped page the reader is entitled to, so
 *     that src/lib/status.ts can link at one address without knowing who is
 *     reading. Adding `/admin/students/:id → /students/:id` while that seed
 *     stands makes the pair bounce between each other forever — and every
 *     attention row on all three homes already points at the neutral address,
 *     so it would be every home, not an edge case.
 *   - The rest of the destinations below are not routes yet. A 308 to a 404 is
 *     worse than the old page still answering.
 *
 * The list is kept here, unlisted, so the commit that moves each route can see
 * what it owes. Waiting on the commit that builds the destination:
 *
 *   /admin/students          → /students                    (the list)
 *   /admin/students/:id      → /students/:id                (the workspace; seed goes)
 *   /mentor/students/:id     → /students/:id                (same commit)
 *   /admin/mentors           → /mentors                     (the list)
 *   /admin/mentors/:id       → /mentors/:id                 (the three views; today
 *                                                            /mentors/:id is the profile
 *                                                            and carries none of the
 *                                                            delivery record)
 *   /admin/programs/:id      → /programs/:id                (the overview; seed goes)
 *   /admin/programs/:id/students → /programs/:id/students
 *   /admin/programs/:id/settings → /programs/:id/settings
 *   /admin/feedback          → /feedback
 *   /mentor/feedback         → /feedback
 *   /mentor/sessions         → /sessions
 *   /mentor/onboarding       → /onboarding
 *   /student/onboarding      → /onboarding
 *   /leader, /leader/students, /leader/feedback, /sales, /sales/students
 *                            → /admin, /students, /feedback, scoped by grant
 *                              (these wait on the permission model, not on a
 *                              page: sending a leader to /admin today bounces
 *                              them off the role gate straight back to /leader)
 *
 * `:id` matches ONE segment, so `/admin/programs/:id` will not swallow
 * `/admin/programs/x/settings` — each nested route needs its own row.
 *
 * The whole map is deleted one released version after the last row lands; the
 * deletion is a listed commit, not a someday.
 */
const MOVED: Move[] = [];

const nextConfig: NextConfig = {
  // A stray lockfile exists in the home directory; pin the workspace root.
  turbopack: { root: __dirname },

  async redirects() {
    // 308, not 307: these addresses are gone for good, and a browser that
    // caches the move stops asking. That is also why a row cannot land early —
    // a mistake here is cached in ten people's browsers, not just served once.
    return MOVED.map(({ from, to }) => ({
      source: from,
      destination: to,
      permanent: true,
    }));
  },
};

export default nextConfig;
