---
name: verify
description: Build, run, and drive the Freshman Academy app locally to verify changes end-to-end (session-cookie login recipe included).
---

# Verifying freshform locally

## Build & run

```bash
npm run build
PORT=3001 npm run start   # port 3000 tends to be held by stale dev servers
```

If 3001 is busy it's usually a stale `next-server` from an earlier session — `lsof -nP -i :3001`, kill it, restart so you're serving the fresh build.

## Signing in as any role (no Google round-trip)

Google blocks consumer-Gmail sign-ins in automated browsers, so mint an Auth.js v5 session cookie directly (JWT strategy; the DAL reads role/status fresh from the DB, so only `uid` matters):

```js
// mint-session.mjs — run with: node mint-session.mjs <uid> <email>
import { createRequire } from "node:module";
const require = createRequire("<repo>/package.json");
const { encode } = await import("file://" + require.resolve("@auth/core/jwt"));
const token = await encode({
  token: { sub: uid, uid, email },
  secret: NEXTAUTH_SECRET,        // from .env
  salt: "authjs.session-token",
  maxAge: 60 * 60 * 8,
});
```

Set it as cookie `authjs.session-token` on `localhost` and visit the role's page. Look up uids with `sqlite3 prisma/dev.db "SELECT id,email,role FROM User;"` (the generated Prisma client is TypeScript — you cannot `require()` it from plain node; use sqlite3).

## Browser automation gotchas

- The Playwright MCP server wants branded Chrome at `/Applications/Google Chrome.app` — not installed on this machine.
- The system Python playwright's Chromium (build 1097) crashes with SIGTRAP on this macOS.
- What works: `npm install playwright && npx playwright install chromium` in the session scratchpad, then drive headless via Node scripts. `page.locator("main").ariaSnapshot()` is the fastest way to read a page.

## Flows worth driving

- Admin (`tech@freshman.academy` is the seeded ADMIN): create student on `/admin/students` (cohort field appears only for programs that have cohorts), register/assign mentors on `/admin/mentors` (program-wide target = one row per pairing; re-assign updates the Calendly link), allocate hours on `/admin/students/[id]` (per-mentor spinbutton + Set).
- Student first sign-in: staff-registered students land on `/student/onboarding` to confirm name + Telegram (`@` prefix is stripped; 5–32 word chars), then `/student` shows hours per mentor.
- Mentor: `/mentor` lists students + log-session form; per-student detail at `/mentor/students/[id]` (there is deliberately no `/mentor/students` index — it 404s).
- Clean up any test rows you create: `Session`, `HourAllotmentChange`, `HourAllocation`, `Notification`, `MentorAssignment`, `StudentProfile`, then `User` (FK order matters).
