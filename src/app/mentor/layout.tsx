import { AppShell } from "@/components/app-shell";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";

export default async function MentorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(ROLES.MENTOR);
  return (
    <AppShell
      user={user}
      roleLabel="Mentor"
      nav={[
        { href: "/mentor", label: "My students" },
        { href: "/mentor/sessions", label: "Sessions" },
        { href: "/mentor/feedback", label: "My feedback" },
      ]}
    >
      {children}
    </AppShell>
  );
}
