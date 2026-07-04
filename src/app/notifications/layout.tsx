import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/dal";

export default async function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
