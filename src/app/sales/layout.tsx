import { AppShell } from "@/components/app-shell";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";

export default async function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(ROLES.SALES);
  return <AppShell user={user}>{children}</AppShell>;
}
