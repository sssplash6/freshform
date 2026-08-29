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
 *   RESCHEDULED  the meeting moved             no time charged at all
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
    chip: "Rescheduled, no time charged",
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

/**
 * Where a logged meeting's hours come from. Asked once, next to attendance,
 * because it is a different question with different consequences:
 *
 *   PLAN   the meeting spends hours the student was allocated  (the default)
 *   EXTRA  work done on top of the allocation — it charges nothing
 *
 * Stored as `Session.withinPlan`. The rule about what EXTRA does to the ledger
 * lives in `chargesAllocation()` (lib/hours.ts), not here.
 */
export const TIME_KIND = {
  PLAN: "PLAN",
  EXTRA: "EXTRA",
} as const;

export type TimeKind = (typeof TIME_KIND)[keyof typeof TIME_KIND];

export const TIME_KIND_META: Record<
  string,
  { label: string; hint: string; chip?: string; tone?: "amber" | "gray" }
> = {
  PLAN: {
    label: "Counts toward their time",
    hint: "The usual case — these hours come out of what the student holds with you.",
  },
  EXTRA: {
    label: "Extra, beyond their time",
    hint: "Work on top of the plan. It shows in the log and against the task, but charges nothing to their balance.",
    chip: "Extra — no time charged",
    tone: "gray",
  },
};

/** How a stored session reads back as one of the two kinds. */
export function timeKindOf(session: { withinPlan: boolean }): TimeKind {
  return session.withinPlan ? TIME_KIND.PLAN : TIME_KIND.EXTRA;
}

/** The column one of the two kinds writes. */
export function timeKindFields(kind: string): { withinPlan: boolean } {
  return { withinPlan: kind !== TIME_KIND.EXTRA };
}

/**
 * THE rule about which logged hours move a balance, in one place.
 *
 * A session spends a student's allocation only when it is ACTIVE (a voided or
 * rescheduled one delivered nothing) AND in-plan (an EXTRA one was given on top
 * of the allocation, so it charges nothing). Everything that sums hours against
 * an allocation asks this — the predicate for rows already in memory, the
 * `CHARGED_SESSION` filter for sums the database does — so the policy can be
 * changed here rather than in a dozen queries that each half-remember it.
 *
 * Note what it deliberately does NOT govern: hours logged against a TASK. Work
 * done out of plan is still work done toward the essay, so goal progress counts
 * every active session (see lib/goal-progress.ts).
 */
export function chargesAllocation(session: {
  status: string;
  withinPlan: boolean;
}): boolean {
  return session.status === SESSION_STATUS.ACTIVE && session.withinPlan;
}

/** The same rule as a Prisma `where` fragment. */
export const CHARGED_SESSION = {
  status: SESSION_STATUS.ACTIVE,
  withinPlan: true,
} as const;

/**
 * A scheduled meeting's life. It starts PROPOSED because the student has not
 * answered yet; only they move it to CONFIRMED or DECLINED, only the mentor
 * CANCELLED, and logging the hours makes it HELD.
 */
export const INTERVIEW_STATUS = {
  PROPOSED: "PROPOSED",
  CONFIRMED: "CONFIRMED",
  DECLINED: "DECLINED",
  CANCELLED: "CANCELLED",
  HELD: "HELD",
} as const;

export type InterviewStatus =
  (typeof INTERVIEW_STATUS)[keyof typeof INTERVIEW_STATUS];

export const INTERVIEW_STATUS_META: Record<
  string,
  { label: string; tone: "green" | "amber" | "gray" | "red" | "violet" }
> = {
  PROPOSED: { label: "Awaiting confirmation", tone: "amber" },
  CONFIRMED: { label: "Confirmed", tone: "green" },
  DECLINED: { label: "Student can't make it", tone: "red" },
  CANCELLED: { label: "Cancelled", tone: "gray" },
  HELD: { label: "Held", tone: "gray" },
};

/** Still in the diary: on the calendar, not cancelled, not yet logged. */
export function interviewIsOpen(interview: { status: string }): boolean {
  return (
    interview.status === INTERVIEW_STATUS.PROPOSED ||
    interview.status === INTERVIEW_STATUS.CONFIRMED ||
    interview.status === INTERVIEW_STATUS.DECLINED
  );
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
  SESSION_DELETED: "SESSION_DELETED", // an admin removed a logged session outright
  STUDENT_SIGNUP: "STUDENT_SIGNUP", // to admins: a student finished onboarding
  ACCOUNT_APPROVED: "ACCOUNT_APPROVED", // to the student: admin approved them
  MENTOR_ASSIGNED: "MENTOR_ASSIGNED", // to the mentor: assigned to a program, set your booking link
  HOURS_DEADLINE: "HOURS_DEADLINE", // to student + mentor: allocation deadline approaching or passed
  ENROLLMENT_MOVED: "ENROLLMENT_MOVED", // to the student: admin corrected their program/cohort
  GOAL_ASSIGNED: "GOAL_ASSIGNED", // to the mentor: an admin gave them a task (usually with the hours for it)
  GOAL_CHANGED: "GOAL_CHANGED", // to the mentor: their task was edited, re-staged or removed
  GOAL_DONE: "GOAL_DONE", // to admins: work an admin planned is finished
  INTERVIEW_SCHEDULED: "INTERVIEW_SCHEDULED", // to the student: a mentor put a meeting in the diary, please confirm
  INTERVIEW_MOVED: "INTERVIEW_MOVED", // to the student: that meeting changed time, please confirm again
  INTERVIEW_CANCELLED: "INTERVIEW_CANCELLED", // to the other side: it's off
  INTERVIEW_ANSWERED: "INTERVIEW_ANSWERED", // to the mentor: the student confirmed, or can't make it
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
  HOURS_GRANTED: { label: "Time", tone: "accent" },
  SESSION_LOGGED: { label: "Session logged", tone: "brand" },
  SESSION_EDITED: { label: "Session corrected", tone: "warning" },
  SESSION_VOIDED: { label: "Session voided", tone: "warning" },
  SESSION_DELETED: { label: "Session removed", tone: "warning" },
  STUDENT_SIGNUP: { label: "New signup", tone: "brand" },
  ACCOUNT_APPROVED: { label: "Approved", tone: "success" },
  MENTOR_ASSIGNED: { label: "Assigned", tone: "brand" },
  HOURS_DEADLINE: { label: "Deadline", tone: "warning" },
  ENROLLMENT_MOVED: { label: "Enrollment", tone: "brand" },
  GOAL_ASSIGNED: { label: "New task", tone: "plan" },
  GOAL_CHANGED: { label: "Task changed", tone: "plan" },
  GOAL_DONE: { label: "Task done", tone: "success" },
  INTERVIEW_SCHEDULED: { label: "Meeting scheduled", tone: "plan" },
  INTERVIEW_MOVED: { label: "Meeting moved", tone: "plan" },
  INTERVIEW_CANCELLED: { label: "Meeting cancelled", tone: "warning" },
  INTERVIEW_ANSWERED: { label: "Meeting answer", tone: "success" },
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
