import { AppShell } from "@/components/app-shell";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(ROLES.STUDENT);
  return (
    <AppShell
      user={user}
      roleLabel="Student"
      nav={[
        { href: "/student", label: "My hours" },
        { href: "/student/book", label: "Book a session" },
        { href: "/student/feedback", label: "Feedback" },
      ]}
    >
      {children}
    </AppShell>
  );
}
