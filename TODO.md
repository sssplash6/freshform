# Backlog

Agreed next batches, in priority order. Nothing here is started.

## Batch 1 — ops at scale

- Name/email search on `/admin/students` (alongside the program filter).
- Pagination on `/mentor/sessions` (currently fetches every session; move
  filtering into the Prisma `where` and use skip/take + count).
- Admin sessions ledger: cross-program sessions table with program / mentor /
  student / date filters, reusing the mentor sessions filter pattern.
- CSV export for admins (students with hour totals; sessions), respecting the
  active filters. Guard route handlers with `getCurrentUser()` + role check —
  layouts don't protect them.

## Batch 2 — correctness hygiene

- Fix the two standing lint errors: `Date.now()` during render in
  `src/components/deadline.tsx`, setState-in-effect in
  `src/components/forms/add-students-form.tsx`.
- Unit-test harness (vitest) around the money logic: `src/lib/hours.ts`,
  allocation diffing in `updateMentor`, hour/date parsing in
  `src/lib/actions/shared.ts`.
- Mentor removal (account), mirroring the student "remove while no sessions"
  rule — currently only assignments can be removed.

## Batch 3 — role gaps

- Staff management UI: create dept leaders / sales accounts from the admin UI
  (today only mentors and students can be created; staff is DB-by-hand).
- Overdraw warning when a mentor logs hours beyond a student's remaining
  balance (allowed silently today).
