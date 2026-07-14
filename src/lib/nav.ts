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
  // No separate Students entry: students live inside each program's page,
  // reached from the dashboard islands.
  [ROLES.ADMIN]: [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/mentors", label: "Mentors" },
    { href: "/admin/feedback", label: "Feedback" },
  ],
  [ROLES.DEPT_LEADER]: [
    { href: "/leader", label: "Dashboard" },
    { href: "/leader/students", label: "Students" },
    { href: "/leader/feedback", label: "Feedback" },
  ],
  [ROLES.SALES]: [
    { href: "/sales", label: "Dashboard" },
    { href: "/sales/students", label: "Students" },
  ],
  [ROLES.MENTOR]: [
    { href: "/mentor", label: "My students" },
    { href: "/mentor/sessions", label: "Sessions" },
    { href: "/mentor/feedback", label: "My feedback" },
  ],
  [ROLES.STUDENT]: [
    { href: "/student", label: "My hours" },
    { href: "/student/book", label: "Book a session" },
    { href: "/student/feedback", label: "Feedback" },
  ],
};
