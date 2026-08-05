import { NotificationList } from "@/components/notification-list";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/** What this feed is for, in the words of the person reading it. */
const BLURB: Record<string, string> = {
  ADMIN:
    "Sessions your mentors log, goals they finish, signups waiting on approval, and every change to a student's hours.",
  DEPT_LEADER: "Changes to students and hours across your program.",
  SALES: "Changes to students and hours across your program.",
  MENTOR:
    "Goals an admin assigns you, hours granted for your students, and deadlines coming up.",
  STUDENT:
    "Every session your mentors log, every change to your hours, and deadlines before they pass.",
};

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          // Feeds the actor's PersonBadge; without it they'd show initials
          // here while wearing their picture everywhere else.
          avatarUpdatedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = notifications.filter((n) => !n.read).length;
  const blurb = BLURB[user.role] ?? "Everything that changed for you.";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={unread > 0 ? `${unread} unread` : "All caught up"}
        title="Notifications"
        subtitle={blurb}
        tone={unread > 0 ? "warm" : "brand"}
      />

      <Panel tone={unread > 0 ? "total" : "neutral"}>
        <PanelHeader
          tone={unread > 0 ? "total" : "neutral"}
          eyebrow="Newest first"
          title={unread > 0 ? "New for you" : "Recent activity"}
          action={
            unread > 0 ? (
              <form action={markAllNotificationsRead}>
                <Button type="submit" variant="secondary" size="sm">
                  Mark all read
                </Button>
              </form>
            ) : undefined
          }
        />

        {notifications.length === 0 ? (
          <EmptyState framed={false} title="Nothing yet">
            {blurb} It all lands here, newest first.
          </EmptyState>
        ) : (
          <NotificationList notifications={notifications} />
        )}
      </Panel>
    </div>
  );
}
