# Freshman Academy — Mentoring Hours

Internal, role-based web app that tracks students' mentoring hours. Students
are granted hours by admins, book sessions with mentors through external
Calendly links, and mentors log completed sessions, which draws down the
student's balance. Everyone sees dashboards scoped to their role and gets
in-app notifications when hours change.

**Stack:** Next.js 16 (App Router) · Prisma 7 + SQLite · Auth.js v5 (Google
only) · Tailwind CSS 4. Deployed as a single Render web service with a
persistent disk.

## Roles

| Role | Home | Can do |
|---|---|---|
| Admin | `/admin` | Everything: create students anywhere, set hour allotments (audited), assign mentors + booking links, cross-program dashboard, all feedback |
| Dept Leader | `/leader` | Create students in their program, program dashboard, program mentor feedback |
| Sales | `/sales` | Create students in their program, program dashboard |
| Mentor | `/mentor` | See assigned students, log/edit/void their own sessions, see their (anonymous) ratings |
| Student | `/student` | Hours + history, book via mentors' Calendly links, leave mentor/website feedback |

**Sign-in rules:** everyone uses Google OAuth. Staff come from the seeded
preset list; students can sign in only if staff created them first
(whitelist); unknown `@freshman.academy` accounts self-register as mentors
with status `UNASSIGNED` until an admin assigns them; all other unknown
emails are rejected.

## Environment variables

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | SQLite file location | `file:./prisma/dev.db` (local), `file:/data/app.db` (Render) |
| `GOOGLE_CLIENT_ID` | Google OAuth client id | `…apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-…` |
| `NEXTAUTH_SECRET` | Auth.js JWT signing secret | output of `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Canonical site URL | `http://localhost:3000` / `https://<service>.onrender.com` |

Copy `.env.example` to `.env` and fill these in.

### Google OAuth setup

In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials),
create an **OAuth client ID** (type: Web application) with:

- Authorized JavaScript origin: `<NEXTAUTH_URL>`
- Authorized redirect URI: `<NEXTAUTH_URL>/api/auth/callback/google`

## Local development

```bash
npm install
cp .env.example .env        # then fill in the values
npx prisma migrate deploy   # create/upgrade the SQLite schema
npx prisma db seed          # programs, starter cohorts, staff preset list
npm run dev                 # http://localhost:3000
```

## Configuration (staff, programs, mentor domain)

Staff accounts, the fixed program/cohort list, and the allowed mentor
sign-up domain live in [`config/app-config.ts`](config/app-config.ts) — not
in application code. Edit that file and re-run `npx prisma db seed`
(idempotent: upserts, never deletes). Replace the placeholder dept-leader
and sales emails with real people before launch.

## Deploying to Render

One **Web Service** + one **persistent disk** (SQLite pins the app to a
single instance — that's the accepted trade-off; the data layer is plain
Prisma so a later move to managed Postgres won't rewrite features).

1. **New → Web Service**, connect this repo.
2. **Disk:** add a disk (1 GB is plenty), mount path `/data`.
3. **Build command:** `npm install && npm run build`
4. **Start command:** `npx prisma migrate deploy && npm start`
   (migrations run against the disk on every deploy; they're no-ops when
   nothing changed)
5. **Environment:** set all five variables from the table above, with
   `DATABASE_URL=file:/data/app.db` and `NEXTAUTH_URL=https://<service>.onrender.com`.
6. Add the Render URL to the Google OAuth client (origin + redirect URI).
7. **First deploy only:** open the service's Shell tab and run
   `npm run db:seed`, then sign in with a seeded admin account.

## Project layout

```
config/app-config.ts     deployment data: mentor domain, programs, staff list
prisma/                  schema, migrations, seed
src/lib/auth.ts          Auth.js config + sign-in gate
src/lib/dal.ts           server-side auth: getCurrentUser / requireRole
src/lib/actions/         all mutations (server actions, permission-checked)
src/lib/queries.ts       derived-hours queries
src/proxy.ts             optimistic redirect to /login (Next 16 middleware)
src/app/<role>/          role-scoped pages behind requireRole layouts
```

Completed and remaining hours are **derived** from `ACTIVE` sessions vs.
`allottedHours` — never stored as counters. Voiding a session returns its
hours automatically. Every allotment change writes an `HourAllotmentChange`
audit row.

## Out of scope (MVP)

Redemption deadlines / expiry, multi-program enrollment, email/SMS (in-app
notifications only), staff management UI (seeded instead), built-in
scheduling or Google Calendar/Meet integration.
