import { ROLES, type Role } from "@/lib/constants";

export type NavItem = { href: string; label: string };

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.DEPT_LEADER]: "Dept Leader",
  [ROLES.SALES]: "Sales",
  [ROLES.MENTOR]: "Mentor",
  [ROLES.STUDENT]: "Student",
};

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  [ROLES.ADMIN]: [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/students", label: "Students" },
    { href: "/admin/mentors", label: "Mentors" },
    { href: "/admin/feedback", label: "Feedback" },
  ],
  // The two scoped roles read the admin pages now, narrowed by their grants
  // rather than by a route of their own. Their old sections were the same three
  // lists with a different prefix and no way to be given a second program.
  [ROLES.DEPT_LEADER]: [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/students", label: "Students" },
    { href: "/admin/feedback", label: "Feedback" },
  ],
  [ROLES.SALES]: [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/students", label: "Students" },
  ],
  [ROLES.MENTOR]: [
    { href: "/mentor", label: "My students" },
    { href: "/mentor/sessions", label: "Sessions" },
    { href: "/mentor/feedback", label: "My feedback" },
  ],
    [ROLES.STUDENT]: [
    { href: "/student", label: "My hours" },
    { href: "/student/meetings", label: "Meetings" },
    { href: "/student/book", label: "Book a session" },
    { href: "/student/feedback", label: "Feedback" },
  ],
};
