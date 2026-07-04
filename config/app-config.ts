// Deployment configuration that is data, not code.
// Edit this file (not application code) to change the mentor sign-up domain,
// the fixed program list, or the staff preset list, then re-run the seed:
//   npx prisma db seed

/**
 * Only Google accounts on this domain may self-register as mentors.
 */
export const ALLOWED_MENTOR_DOMAIN = "freshman.academy";

/**
 * Programs are fixed for the MVP. Cohorts under each program are seeded as
 * starters; admins create students into them.
 */
export const PROGRAMS: { name: string; cohorts: string[] }[] = [
  { name: "Master's", cohorts: ["Cohort 1"] },
  { name: "Admissions Program", cohorts: ["Cohort 1"] },
  { name: "Global Support", cohorts: ["Cohort 1"] },
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
    email: "leader.masters@freshman.academy",
    name: "Master's Dept Leader (placeholder)",
    role: "DEPT_LEADER",
    program: "Master's",
  },
  {
    email: "leader.admissions@freshman.academy",
    name: "Admissions Dept Leader (placeholder)",
    role: "DEPT_LEADER",
    program: "Admissions Program",
  },
  {
    email: "leader.global@freshman.academy",
    name: "Global Support Dept Leader (placeholder)",
    role: "DEPT_LEADER",
    program: "Global Support",
  },
  {
    email: "sales.masters@freshman.academy",
    name: "Master's Sales (placeholder)",
    role: "SALES",
    program: "Master's",
  },
  {
    email: "sales.admissions@freshman.academy",
    name: "Admissions Sales (placeholder)",
    role: "SALES",
    program: "Admissions Program",
  },
  {
    email: "sales.global@freshman.academy",
    name: "Global Support Sales (placeholder)",
    role: "SALES",
    program: "Global Support",
  },
];
