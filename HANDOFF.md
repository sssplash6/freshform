# Pick up here

State of the UX reorganisation as of the last commit on `main`. The plan is
`REDESIGN.md` — it is the contract and it is still accurate. This file is only
"where the work stopped and what to do next".

---

## Where it stopped

**39 commits.** `git log --oneline addf3b1~1..HEAD` is the whole series.

| Phase | REDESIGN.md commits | State |
|---|---|---|
| 0 — audit, spec, safety | — | **done.** `REDESIGN.md` written; a data leak fixed (`8cd59a9`); the hours engine got tests before anything moved (`6bac963`); deploys made manual (`d9ebd85`) |
| 1 — shared foundation | 1–16 | **done.** Every commit landed |
| 2 — the three homes | 17–21 | **done.** `/sessions/new`, `AttentionList` + `Timeline`, `/mentor`, `/admin`, `/student` |
| 3 — permissions, program scope | 22–28 | **not started.** This is the owner's per-program-admin ask |
| 4 — shell and lens | 29–32 | commit 30's `ui/segmented.tsx` **done** early (it replaced both pickers and the program tabs). 29, 31, 32 not started |
| 5 — shared renderers | 33–38 | **components built, call sites not rewritten.** See "Built but unmounted" |
| 6 — role-neutral routes | 39–47 | **not started**, except the two redirect seeds (`/students/[id]`, `/programs/[id]`) added in `eb566d6` so `lib/status.ts` links resolve |
| 7 — settings, platform, student app | 48–53 | commit 52's `/student/meetings` **done** early, because removing `StudentJourney` from the home had left a student with no history at all |
| 8 — copy, docs, cleanup | 54–59 | **not started** |

Roughly 23 of 59 numbered commits, and the foundation everything else stands on
is finished.

### Verified green at the stopping point

```
npx tsc --noEmit     clean
npm run lint         clean  (eslint + check-colors + check-copy, both custom checks are ERRORS)
npm test             161 passed
npm run build        compiles
```

### What the numbers moved

| | before | now |
|---|---|---|
| raw Tailwind palette classes in `src/` | 106 | **0** (the build fails on one) |
| colour tokens | 47 | 28 |
| identity hues | 8 | 3, muted |
| `StatCard` implementations | 57 | 1 `Figure` |
| banned copy habits | 51 | **0** (the build fails on one) |
| unanchored `truncate` | 13 | **0** |
| tests | 0 | 161 |
| admin inbox rows on the real data | 36 statuses | 6 rows |
| student's first actionable row at 390×664 | — | 284px (required: above 420) |
| a mentor's caseload | 0 students / picker offered 11 | 9, from one definition |

---

## Next, in order

1. **Phase 3, commit 22.** `ProgramStaff` + `User.platformAdmin` + the seed + `config/app-config.ts`
   + the `deleteProgram` guard, **in one commit** — §8.5 explains why it cannot be split (`render.yaml`
   runs `db:seed` on every boot, so a config-shaped grant list would re-grant an admin the owner had
   just demoted). Then commit 23, `src/lib/authz.ts` + tests. This is the change the owner actually
   asked for: per-program admin grants and a platform page to make them.
2. **Phase 5 call sites.** The five components below are written, tested and unmounted. Wiring them
   is mostly deletion.
3. **Phase 6.** The route moves. Commit 39 must land first and alone — the redirect map, the
   role-neutral hrefs from `notify.ts`, and `/n/[id]` together, so no link ever points at a route
   that does not exist.

## Built but unmounted

All five compile, lint and were rendered once in a throwaway preview route (since deleted). None
has a call site yet. They are Phase 5's commits 33–37.

| File | Replaces | Call sites to rewrite |
|---|---|---|
| `src/components/session-row.tsx` | `meetings-log.tsx` (6 routes), `LedgerBoard.LoggedMeetingRow`, `student-journey.tsx`, the `/mentor/sessions` table | one done: `/student/meetings` uses `variant="timeline"` |
| `src/components/task-row.tsx` | `assignments-panel.tsx`, `LedgerBoard.TaskRow`, `student-goals.tsx`, the program page table | none |
| `src/components/ui/filter-bar.tsx` + `src/lib/filters.ts` | `ui/search-form.tsx`, `mentor-hours-filter.tsx` (322 lines), 3 filter cards | none. 53 tests already pass |
| `src/components/ui/row-action-menu.tsx` + `ui/popover.tsx` | the four `*-row-actions.tsx` popovers | none |
| `src/components/ui/confirm-inline.tsx` | 8 two-step confirms | none |

**Orphaned and safe to delete once their replacements are mounted:**
`mentor-hours-list.tsx` (superseded by `/student/book`'s own cards),
`program-island-card.tsx`, `student-goals.tsx`, `student-journey.tsx`.

---

## Known gaps, deliberate

Each of these is a thing the plan puts in a later phase. None is a mistake; they
are listed so nobody rediscovers them as bugs.

- **`TASK_OVERDUE` is dormant.** `Assignment.deadline` is free text holding both "Aug 7" and
  "March–May". It needs **M6** (commit 53) to split into `dueNote` + `dueOn`. Until then no task is
  flagged overdue and no task due dates appear in "Up next". Guessing at the free text is how a task
  gets flagged overdue for a range it is still inside.
- **No `/sessions` list.** Only `/sessions/new` exists. So "Up next" on `/mentor` has no "see all"
  link, and `/admin`'s Recent has none either — pointing them at `/mentor/sessions` would send the
  reader to a log of what was delivered from a heading about what is scheduled. Commit 42.
- **`CreateProgramForm` is unmounted.** It was on the old `/admin`; its new home is
  `/settings/platform` (commit 49). **A program cannot currently be created through the UI.** If
  that is needed before Phase 7, mount the existing form somewhere temporarily.
- **`STAFF_UNSCOPED` renders as "no program exists at all"**, because grants do not exist until
  Phase 3.
- **Roll-up rows have no destination.** "8 students are overdrawn" deliberately drops its `href`
  (linking to one of eight is an arbitrary choice); it wants the filtered `/students` list from
  commit 40.
- **Money is still gated on `MASTERS_PROGRAM_NAME`**, a string match at four sites. Commit 45
  replaces it with a per-program `tracksPayment` toggle.
- **Touch targets still under 44px**, all listed against Phase 4 in `REDESIGN.md` §9: the
  notification bell (40), `<Select>` (40), `PersonChip` as a link (40), and — the one that matters —
  the RSVP pair at 32px on `/student`, which sits next to its opposite, so a mis-tap declines a
  meeting.

## Regression hunt, in flight

Three audits were running when work stopped, one per surface (student, mentor, admin + shared
primitives). Their method is worth repeating for any future rewrite, because it caught things
review did not: **the spec says what a section should SHOW; it does not say what the old component
let a user DO.** Anything that was an affordance rather than a feature can vanish silently.

Four found and fixed already:

1. `InterviewResponse` lets a student **change** an answer — both buttons stay live. Moving the
   control to only the "awaiting your answer" row took that away. Fixed in `fd6ca57`.
2. A meeting with no time set rendered **"All day"** instead of "time to be confirmed".
3. `student-journey.tsx` was **orphaned** — a student could not see a single past session anywhere.
   `/student/meetings` built.
4. A **passed meeting vanished** from a student's week, because `MEETING_UNLOGGED` had no student
   voice. It now reads "Waiting on your mentor".

The student and mentor audits finished, and a primitives audit (chips, `StatCard`, the link
components) finished. **The `/admin` page audit died on a rate limit before reporting — re-run
it.** Scope: the old `/admin` surfaces plus `EmptyState` losing its `action` slot, `Callout` going
4 tones → 3, `CreateProgramForm` having no mount, and the admin sub-pages
(`admin/students`, `admin/mentors`, `admin/programs/**`, `admin/feedback`, `/leader`, `/sales`)
against the helpers that changed under them: `studentsWithHours` gained a parameter and a returned
field, `attentionList` stopped injecting `ALL_CLEAR`, `rollUp` drops `href`, `programTotals`
replaced five reduces. The prompt shape is: enumerate everything the old component let a user do,
trace each to where it is reachable today, report only what is not, graded
BROKEN / DEGRADED / MOVED / DELIBERATE. Read-only; no edits.

### Primitives audit — the one real bug it found

**Two "Time remaining" figures lost their red.** `admin/mentors/[id]` (old `:194` → now `:189-192`)
and `admin/programs/[id]` (old `:184` → now `:176-179`) both passed
`tone={remaining < 0 ? "danger" : "default"}` and now pass no tone at all, so **a negative balance
renders in plain ink on both pages.** This is fallout from the tone-stripping regex in `73aca3d`,
which was known to have caught two `StatCard`s and was re-decided for those two — these two were
not noticed. One prop each.

Everything else it found is wording or reach, not correctness:

- **`Figure` is a strict superset of `StatCard`** — every prop has an equivalent, plus one guard
  `StatCard` lacked. No capability lost in the primitive itself. (`figure.tsx:6` says 57 instances;
  the real count at the baseline was 48.)
- `DeadlineText` reproduces `deadline.tsx` exactly, and all six call sites survive.
- **"Sessions logged" exists nowhere in the app** (0 grep hits). "Time allotted", "Time completed",
  "Time missed" are gone from `/admin`; "Time delivered", "Time missed", "Time beyond plan" from
  `/mentor`. Deliberate per the plan, but worth confirming the owner agrees a mentor never needs
  their own lifetime delivery figure.
- **Telegram and Folder left `/mentor` entirely** with the 9→5 column cut — a mentor can no longer
  message a student or open their folder from the caseload, only from the student page.
- **The Folder tooltip lost the URL.** It was `"Open the student's folder (https://…)"`; it is now
  `"Open the student's folder"`, so staff cannot see where a link points without clicking.
- **`{X} extra` per student is gone from the mentor caseload** and `s.extra` is now unused there —
  out-of-plan time delivered is only visible per session on the student page.
- Lateness lost its amber: `SESSION_LATE` is `neutral`, where the old chip was amber. And the
  student-voiced "Extra — none of your used" reassurance became the staff-neutral
  "Extra, no time charged".
- `INTERVIEW_STATUS_META` (`constants.ts:218-227`) is now **dead code** — only a comment and a test
  reference it.
- **`StatusChip`'s free-text form is still used at 26 call sites**, so `lib/status.ts` is not yet
  the only source of chip wording. Those 26 are the pages Phase 6 has not reached.

---

## ⚠ START HERE: one bug is actively rotting

**`/mentor`'s "Up next" never filters `interviewIsOpen`.** `src/app/mentor/page.tsx:181-183`
filters only on `bucketOf(...) !== "later"`, and `mentorMeetings` returns *every interview ever*
(`src/lib/queries.ts:220-226`). Logging a session sets `HELD`; cancelling sets `CANCELLED`. Neither
is excluded.

So every meeting a mentor has ever logged or cancelled sits under **Overdue** forever, with an
amber edge and a live Move/Cancel menu on an action that should not exist for it. Overdue is the
first bucket rendered and rows sort ascending inside it, which means **"Up next" opens with the
mentor's oldest meeting ever.** By month two the section cannot answer the question it is named
for.

It does not show in dev because the seed data has almost no closed history. Every other reader of
`mentorMeetings`/`studentMeetings` applies this filter — `splitMeetings` (`src/lib/interviews.ts:56`),
`src/app/student/page.tsx:257` — so `/mentor` is the one page that forgot it.

**The fix is one predicate.** Do it before anything else.

---

### Student audit — open findings, NOT fixed

Three of its findings landed in `c26904a`; these did not, and are ordered by what it would fix
first.

1. **BROKEN — a per-mentor time ledger has no home.** The old `mentor-hours-list.tsx` read
   `hours.perMentor`, i.e. `HourAllocation`. `/student/book` keys off `MentorAssignment`
   (`src/app/student/book/page.tsx:39-49`), and so do the home's booking rows. So **hours a student
   still holds with a mentor whose pairing was removed are inside the ring total and named
   nowhere** — they cannot tell whose time it is or who to chase. `mentor-hours-list.tsx` was
   already migrated to `Section`/`DeadlineText` during the rewrite and then left with no importer;
   it needs a mount, not a rewrite. It also still carries the per-mentor "· 30m missed" and
   "· 2h expired unused" figures, which exist only as aggregates now.
2. **DEGRADED — `remaining === 0` says nothing.** `BALANCE_NONE` fires only at
   `allottedMinutes === 0` and `BALANCE_OVERDRAWN` only below zero (`src/lib/status.ts:766-771`), so
   a student who has used exactly all of their time sees a ring reading "0m / time left", an empty
   "Needs you", and no guidance. The old page said "Your mentoring time are all used up. Talk to
   your program contact about topping up." Wants its own status type.
3. **DEGRADED — meetings more than 7 days out are not on the home.** `bucketOf` sends day 8+ to
   `later` and the home renders `["overdue","today","week"]`. Now reachable via the "All meetings"
   link and the nav, so it is no longer BROKEN, but an interview three weeks out is still invisible
   on the page a student opens.
4. **DEGRADED — the mentor count is gone.** "N meetings logged · N mentors on your team" was in the
   old footer. The meeting count is back as the `Past sessions` count; "how many people am I working
   with" now means counting cards on `/student/book`.
5. **DEGRADED — two explanatory empty states got shorter.** The home Timeline passes no `empty`, so
   it falls back to "Nothing scheduled." where the old text named who makes meetings appear. The new
   `/student/meetings` page does pass the fuller wording.
6. **DEGRADED — no diary tally.** "2 coming up · 1 confirmed · 1 awaiting an answer" has no
   equivalent on either Timeline.

Its DELIBERATE list agreed with every removal the plan made: the orange hero, the 120px watermark,
the balance sentence, the PENDING wall, `DateLeaf`, the four rival session renderers, the
self-computed section totals, and dropping "Still yours" from the breakdown key. `student-journey.tsx`
and `student-goals.tsx` it confirmed as genuinely superseded dead code. `mentor-hours-list.tsx` it
confirmed as an accidental orphan — see finding 1.

---

## How to run it

`.claude/skills/verify/SKILL.md` has the full recipe. The short version:

```bash
npm run dev                      # or: npm run build && PORT=3001 npm run start
npx prisma migrate deploy        # against prisma/dev.db
npm run db:seed
```

- **Node 22.** `npm rebuild better-sqlite3` if you see an ABI mismatch (127 vs 141).
- The demo data lives in `prisma/dev.db`: 3 programs, 11 students (all in Master's), 8 mentor
  pairings, 74 sessions. Ten of the eleven students are overdrawn, which is what makes the admin
  inbox's roll-up worth looking at.
- **Deploys are manual.** `render.yaml` has `autoDeploy: false`. The owner still needs to switch
  Auto-Deploy off in the Render dashboard itself — the yaml only governs blueprint syncs.

### Verifying a UI change

Screenshots at **390px and 1280px**, signed in as each role. Tokens are minted from `.env`'s
`NEXTAUTH_SECRET`; the recipe is in the verify skill. Measure rather than eyeball: every mistake
this series caught in its own work was caught by reading a rendered number — element heights,
`document.documentElement.scrollWidth`, computed colours, `aria-expanded` — not by looking.

## Two habits worth keeping

- **`git checkout <file>` threw away uncommitted work twice.** For mutation-testing a guard, copy
  the file, mutate, run, `mv` it back. `scripts/lib/swap.py` exists because the naive
  whitespace-flexible matcher aborts a migration half-applied.
- **A function cannot cross the server→client boundary.** It type-checks, it builds, and it throws
  at render. Passing `correctHref={(id) => ...}` from a page to a client component cost a debug
  cycle; it is a string base now.
