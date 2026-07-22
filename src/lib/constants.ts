// Allowed values for the string columns in the Prisma schema.
// SQLite has no native enums, so these are enforced in application code.

export const ROLES = {
  ADMIN: "ADMIN",
  DEPT_LEADER: "DEPT_LEADER",
  SALES: "SALES",
  MENTOR: "MENTOR",
  STUDENT: "STUDENT",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const USER_STATUS = {
  ACTIVE: "ACTIVE",
  UNASSIGNED: "UNASSIGNED", // freshly signed-up mentors awaiting cohort assignment
  PENDING: "PENDING", // self-signed-up students awaiting admin approval
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const SESSION_STATUS = {
  ACTIVE: "ACTIVE",
  VOIDED: "VOIDED",
} as const;

export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

export const NOTIFICATION_TYPES = {
  HOURS_GRANTED: "HOURS_GRANTED",
  SESSION_LOGGED: "SESSION_LOGGED",
  SESSION_EDITED: "SESSION_EDITED",
  SESSION_VOIDED: "SESSION_VOIDED",
  STUDENT_SIGNUP: "STUDENT_SIGNUP", // to admins: a student finished onboarding
  ACCOUNT_APPROVED: "ACCOUNT_APPROVED", // to the student: admin approved them
  MENTOR_ASSIGNED: "MENTOR_ASSIGNED", // to the mentor: assigned to a program, set your booking link
  HOURS_DEADLINE: "HOURS_DEADLINE", // to student + mentor: allocation deadline approaching or passed
  ENROLLMENT_MOVED: "ENROLLMENT_MOVED", // to the student: admin corrected their program/cohort
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

/**
 * Whether a user may operate as a mentor: either a plain MENTOR, or an ADMIN
 * who was also flagged as a mentor (dual-role admins). Used by the mentor-side
 * gates and the mentor-pool queries so admin-mentors are first-class mentors.
 */
export function canActAsMentor(user: {
  role: string;
  isMentor?: boolean | null;
}): boolean {
  return user.role === ROLES.MENTOR || (user.role === ROLES.ADMIN && !!user.isMentor);
}

// Home route for each role after sign-in.
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin",
  DEPT_LEADER: "/leader",
  SALES: "/sales",
  MENTOR: "/mentor",
  STUDENT: "/student",
};
