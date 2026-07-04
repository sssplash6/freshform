import { AppShell } from "@/components/app-shell";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(ROLES.ADMIN);
  return (
    <AppShell
      user={user}
      roleLabel="Admin"
      nav={[
        { href: "/admin", label: "Dashboard" },
        { href: "/admin/students", label: "Students" },
        { href: "/admin/mentors", label: "Mentors" },
        { href: "/admin/feedback", label: "Feedback" },
      ]}
    >
      {children}
    </AppShell>
  );
}
