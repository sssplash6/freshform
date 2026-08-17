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
 * The pieces of work hours are normally granted for. Allocating hours names one
 * of these (or anything typed in its place), which is what the mentor then logs
 * every session against — so this list is the shared vocabulary of the two
 * halves of the app. Editing it changes what the pickers offer; tasks already
 * created keep the wording they were created with.
 */
export const TASK_PRESETS: string[] = [
  "Personal Statement Review",
  "Overall profile review and University advising",
  "Supplemental Essays",
  "Recommendation Essays & Bragsheets",
  "EC descriptions",
  "University Selection",
];

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
 * DEPT_LEADER and SALES; it must be null for ADMIN. `isMentor: true` marks a
 * dual-role admin who can also act as a mentor (toggle into the mentor
 * dashboard, be assigned to programs).
 *
 * This is the exclusive list of admins. Most are mentors too — the exceptions
 * are tech@ (the developer account) and admins who simply don't mentor, who
 * are left without the flag. Add DEPT_LEADER / SALES entries with real emails
 * when those people are known, then re-run the seed (the seed only upserts,
 * so it never removes anyone).
 */
export const STAFF_SEED: {
  email: string;
  name: string;
  role: "ADMIN" | "DEPT_LEADER" | "SALES";
  program: string | null;
  isMentor?: boolean;
}[] = [
  {
    email: "tech@freshman.academy",
    name: "Freshman Academy Admin",
    role: "ADMIN",
    program: null,
    // Developer account, not a mentor.
  },
  {
    email: "sharofiddin@freshman.academy",
    name: "Sharofiddin",
    role: "ADMIN",
    program: null,
    isMentor: true,
  },
  {
    email: "sega@freshman.academy",
    name: "Sega",
    role: "ADMIN",
    program: null,
    isMentor: true,
  },
  {
    email: "sanjar@freshman.academy",
    name: "Sanjar",
    role: "ADMIN",
    program: null,
    isMentor: true,
  },
  {
    email: "valera@freshman.academy",
    name: "Valera",
    role: "ADMIN",
    program: null,
    isMentor: true,
  },
  {
    email: "shahrizoda@freshman.academy",
    name: "Shahrizoda",
    role: "ADMIN",
    program: null,
    // Admin only — does not mentor students.
  },
  {
    email: "khusanboy@freshman.academy",
    name: "Khusanboy",
    role: "ADMIN",
    program: null,
    // Admin only until told otherwise — add isMentor: true if he also mentors.
  },
];
