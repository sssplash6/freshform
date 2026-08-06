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
  // The meeting moved, so nothing was delivered. Kept as a status rather than an
  // attendance state because every hours query already counts ACTIVE only —
  // which is exactly the accounting a rescheduled meeting needs.
  RESCHEDULED: "RESCHEDULED",
} as const;

export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

/**
 * What kind of meeting a mentor is logging. One question with four answers,
 * because they are mutually exclusive and each one means something different for
 * the hours:
 *
 *   ATTENDED     the meeting happened          hours charged, delivered
 *   LATE         it happened, they were late   hours charged, delivered
 *   ABSENT       they didn't come              hours charged, tallied as missed
 *   RESCHEDULED  the meeting moved             no hours charged at all
 *
 * Stored across `attended`, `late` and `status` (see attendanceOf), so the hours
 * engine keeps working off ACTIVE sessions without knowing this vocabulary.
 */
export const ATTENDANCE = {
  ATTENDED: "ATTENDED",
  LATE: "LATE",
  ABSENT: "ABSENT",
  RESCHEDULED: "RESCHEDULED",
} as const;

export type Attendance = (typeof ATTENDANCE)[keyof typeof ATTENDANCE];

export const ATTENDANCE_META: Record<
  string,
  { label: string; hint: string; chip?: string; tone?: "amber" | "gray" }
> = {
  ATTENDED: { label: "Attended", hint: "The meeting happened as planned." },
  LATE: {
    label: "Came late",
    hint: "It happened; log the hours you actually spent.",
    chip: "Came late",
    tone: "amber",
  },
  ABSENT: {
    label: "Absent",
    hint: "A no-show. The hours are still charged, but tallied as missed.",
    chip: "No-show, hours still charged",
    tone: "amber",
  },
  RESCHEDULED: {
    label: "Rescheduled",
    hint: "The meeting moved, so no hours are charged.",
    chip: "Rescheduled, no hours charged",
    tone: "gray",
  },
};

/** How a stored session reads back as one of the four states. */
export function attendanceOf(session: {
  attended: boolean;
  late: boolean;
  status: string;
}): Attendance {
  if (session.status === SESSION_STATUS.RESCHEDULED) return ATTENDANCE.RESCHEDULED;
  if (!session.attended) return ATTENDANCE.ABSENT;
  return session.late ? ATTENDANCE.LATE : ATTENDANCE.ATTENDED;
}

/** The three columns one of the four states writes. */
export function attendanceFields(state: string): {
  attended: boolean;
  late: boolean;
  status: string;
} {
  switch (state) {
    case ATTENDANCE.LATE:
      return { attended: true, late: true, status: SESSION_STATUS.ACTIVE };
    case ATTENDANCE.ABSENT:
      return { attended: false, late: false, status: SESSION_STATUS.ACTIVE };
    case ATTENDANCE.RESCHEDULED:
      // attended stays true so that, if the status is ever corrected back, the
      // hours land as delivered rather than silently as missed.
      return { attended: true, late: false, status: SESSION_STATUS.RESCHEDULED };
    default:
      return { attended: true, late: false, status: SESSION_STATUS.ACTIVE };
  }
}

/** How far along one planned piece of work is. Admin-set, never derived. */
export const ASSIGNMENT_PROGRESS = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
} as const;

export type AssignmentProgress =
  (typeof ASSIGNMENT_PROGRESS)[keyof typeof ASSIGNMENT_PROGRESS];

/**
 * Value the progress control submits to mean "stop pinning this, follow the
 * logged hours again". Not a progress state — a release of the manual pin.
 */
export const ASSIGNMENT_PROGRESS_AUTO = "AUTO";

export const ASSIGNMENT_PROGRESS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

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
  GOAL_ASSIGNED: "GOAL_ASSIGNED", // to the mentor: an admin gave them a task (usually with the hours for it)
  GOAL_CHANGED: "GOAL_CHANGED", // to the mentor: their task was edited, re-staged or removed
  GOAL_DONE: "GOAL_DONE", // to admins: work an admin planned is finished
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

/**
 * How each kind of notification reads in a list: a short label and the tone it
 * carries. Grouped so the page can say what an item IS before its sentence, and
 * so the eye can sort a mixed feed without reading every line.
 */
export const NOTIFICATION_META: Record<
  string,
  { label: string; tone: "brand" | "accent" | "plan" | "success" | "warning" }
> = {
  HOURS_GRANTED: { label: "Hours", tone: "accent" },
  SESSION_LOGGED: { label: "Session logged", tone: "brand" },
  SESSION_EDITED: { label: "Session corrected", tone: "warning" },
  SESSION_VOIDED: { label: "Session voided", tone: "warning" },
  STUDENT_SIGNUP: { label: "New signup", tone: "brand" },
  ACCOUNT_APPROVED: { label: "Approved", tone: "success" },
  MENTOR_ASSIGNED: { label: "Assigned", tone: "brand" },
  HOURS_DEADLINE: { label: "Deadline", tone: "warning" },
  ENROLLMENT_MOVED: { label: "Enrollment", tone: "brand" },
  GOAL_ASSIGNED: { label: "New task", tone: "plan" },
  GOAL_CHANGED: { label: "Task changed", tone: "plan" },
  GOAL_DONE: { label: "Task done", tone: "success" },
};

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
