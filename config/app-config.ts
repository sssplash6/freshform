// Deployment configuration that is data, not code.
// Edit this file (not application code) to change the mentor sign-up domain,
// the fixed program list, or the staff preset list, then re-run the seed:
//   npx prisma db seed

/**
 * Only Google accounts on this domain may self-register as mentors.
 */
export const ALLOWED_MENTOR_DOMAIN = "freshman.academy";

/**
 * Programs are fixed for the MVP. Only the Global Admissions Program has set
 * cohorts (seeded as starters); students in the other programs belong to the
 * program directly.
 */
export const PROGRAMS: { name: string; cohorts: string[] }[] = [
  { name: "Global Admissions Program", cohorts: ["Cohort 1"] },
  { name: "Flexible Program", cohorts: [] },
  { name: "Master's Program", cohorts: [] },
];

/**
 * Staff preset list (managing staff via the UI is post-MVP).
 * `program` must match a PROGRAMS entry name and is required for
 * DEPT_LEADER and SALES; it must be null for ADMIN.
 *
 * TODO: replace the placeholder entries below with real staff emails
 * before deploying.
 */
export const STAFF_SEED: {
  email: string;
  name: string;
  role: "ADMIN" | "DEPT_LEADER" | "SALES";
  program: string | null;
}[] = [
  {
    email: "tech@freshman.academy",
    name: "Freshman Academy Admin",
    role: "ADMIN",
    program: null,
  },
  // ── Placeholders — replace with real people ──────────────────────────
  {
    email: "leader.admissions@freshman.academy",
    name: "Global Admissions Dept Leader (placeholder)",
    role: "DEPT_LEADER",
    program: "Global Admissions Program",
  },
  {
    email: "leader.flexible@freshman.academy",
    name: "Flexible Dept Leader (placeholder)",
    role: "DEPT_LEADER",
    program: "Flexible Program",
  },
  {
    email: "leader.masters@freshman.academy",
    name: "Master's Dept Leader (placeholder)",
    role: "DEPT_LEADER",
    program: "Master's Program",
  },
  {
    email: "sales.admissions@freshman.academy",
    name: "Global Admissions Sales (placeholder)",
    role: "SALES",
    program: "Global Admissions Program",
  },
  {
    email: "sales.flexible@freshman.academy",
    name: "Flexible Sales (placeholder)",
    role: "SALES",
    program: "Flexible Program",
  },
  {
    email: "sales.masters@freshman.academy",
    name: "Master's Sales (placeholder)",
    role: "SALES",
    program: "Master's Program",
  },
];
