import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile exists in the home directory; pin the workspace root.
  turbopack: { root: __dirname },

  /**
   * Old routes, kept alive while links to them are still in the wild.
   *
   * The reorganisation gives every entity one role-neutral address —
   * /admin/students/[id] and /mentor/students/[id] become /students/[id], the
   * /leader and /sales trees fold into /programs/[id] — and there are two kinds
   * of link that cannot be edited to match: bookmarks in ten people's browsers,
   * and the `href` already stored on hundreds of `Notification` rows.
   *
   * Stored hrefs are NEVER rewritten. A notification is a record of what was
   * said at the time, and a migration that edits its link edits history; the
   * /n/[id] handler (Phase 6) resolves an old row to wherever its subject lives
   * now instead. This map covers the bookmarks.
   *
   * It is filled in by the commit that moves the routes and deleted in Phase 8,
   * one release later — a permanent redirect table is a second sitemap nobody
   * maintains.
   */
  async redirects() {
    return [];
  },
};

export default nextConfig;
