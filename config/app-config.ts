// Deployment configuration that is data, not code.
// Edit this file (not application code) to change the mentor sign-up domain,
// the fixed program list, or the staff preset list, then re-run the seed:
//   npx prisma db seed

/**
 * Only Google accounts on this domain may self-register as mentors.
 */
export const ALLOWED_MENTOR_DOMAIN = "freshman.academy";

/**
 * The Master's Program is billed per student: when an admin allocates hours to
 * a Master's student they also record the amount paid. Matched by program name.
 */
export const MASTERS_PROGRAM_NAME = "Master's Program";

/**
 * Starter programs. All are flat single programs — no seeded cohorts;
 * students belong to the program directly. Admins can add cohorts (and whole
 * programs) from the dashboard when a program grows into them.
 */
export const PROGRAMS: { name: string; cohorts: string[] }[] = [
  { name: "Global Admissions Program", cohorts: [] },
  { name: "Flexible Program", cohorts: [] },
  { name: MASTERS_PROGRAM_NAME, cohorts: [] },
];

/**
 * Staff preset list, seeded on every deploy (managing staff via the UI is
 * post-MVP). `program` must match a PROGRAMS entry name and is required for
 * DEPT_LEADER and SALES; it must be null for ADMIN.
 *
 * Only the real admin ships here. Add DEPT_LEADER / SALES entries with real
 * emails (each tied to one PROGRAMS name) when those people are known, then
 * re-run the seed — the seed only upserts, so it never removes anyone.
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
];
