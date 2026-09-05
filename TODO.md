# Backlog

Agreed next batches, in priority order. Nothing here is started.

Everything that used to be in Batch 1 and Batch 2 was done by the reorganisation
(`REDESIGN.md`) and is listed at the bottom, so nobody re-opens a solved
problem. `REDESIGN.md` §11 is the other half of this file: things deliberately
kept out of that work, each with the reason.

## Batch 1 — what the owner asked for on 4 September, unbuilt

Voice notes, transcribed from a phone. Check each against what he meant before
building it.

- **An hours-DYNAMICS view.** "Who is missing hours, who is performing how."
  Everything in the product is a snapshot — balances, totals, what needs doing
  today. This asks for change over time, and it has a dependency: no table
  records a *rate*, so somebody has to decide the window (per week? per month?)
  and whether it is derived from `Session.date` alone. Needs its own spec
  section before any of it is built.
- **A persistent "+" to add time and to log, in one tap.** `/sessions/new`
  exists and both homes link it; he is asking for something lighter and always
  to hand, probably in the shell.
- **Round the orienting figures.** "130h 07m" should read "130+ hours".
  `formatApprox` exists and the rule is drawn — a figure you *orient* by rounds,
  a figure that is *the record* stays exact — but the rounding is not applied
  everywhere he meant. Ask him to confirm the split before widening it.
- **Cut the scrolling, everywhere.** "Show them, and if it's interesting I'll
  open it further." `ui/disclosure.tsx` exists for exactly this and is used in
  five places; every long list should default to a short, dense form.

## Batch 2 — correctness hygiene

- Overdraw warning when a mentor logs beyond a student's remaining balance
  (allowed silently today, by decision — but silently is the part to fix).
- Mentor removal (the account), mirroring the student "remove while no sessions
  exist" rule. Today only pairings can be removed.
- CSV export for admins (students with hour totals; sessions), respecting the
  active filters. A route handler must call `requireAdminAccess()` itself —
  layouts do not protect route handlers.
- The unread-count on the sidebar's **Inbox** item. It renders without a number
  because the only honest source is the attention list each home already
  builds, and asking a second time would double the cost of every render. It
  wants one `cache()`d query shared by the shell and the homes.

## Batch 3 — after a release

- **Delete the redirect map** in `next.config.ts`. Every row landed on
  5 September 2026; the map comes out one released version later, which is a
  date somebody has to choose, not a state the code can detect.
- **Drop `User.weeklyDigest`.** Superseded by `NotificationPreference`, kept
  only because the HMAC unsubscribe links already in people's inboxes write it.
  Goes when the last of those emails has aged out.

---

## Done by the reorganisation

Do not re-open these; they are in `git log` and in `REDESIGN.md`'s phase list.

- Name/email search on the students list — it is `FilterBar` + `studentsWhere`,
  and every narrowing is a Prisma `where` rather than a pass over the school.
- Pagination on the sessions list, which is now `/sessions` and pages properly.
- The admin sessions ledger — `/sessions`, both tabs, cross-program.
- A vitest harness around the money logic: 196 tests, starting with
  `src/lib/hours.ts`.
- The two standing lint errors (`Date.now()` during render, setState-in-effect).
- Staff management: `/settings/platform` grants program access, which is what
  "create dept leaders" was really asking for. Scope is a row now, not a role.
