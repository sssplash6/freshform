import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import { requireUser } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Notifications</h1>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-md border border-brand px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand hover:text-white"
            >
              Mark all read ({unread})
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-8 text-[15px] text-muted-fg">
          Nothing yet. You&apos;ll be notified here whenever your hours change.
        </p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border p-3 text-sm ${
                n.read
                  ? "border-line bg-surface text-muted-fg"
                  : "border-accent/40 bg-accent-soft text-ink"
              }`}
            >
              <p>{n.message}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-fg">
                  {formatDateTime(n.createdAt)}
                </p>
                {!n.read && (
                  <form action={markNotificationRead}>
                    <input
                      type="hidden"
                      name="notificationId"
                      value={n.id}
                    />
                    <button
                      type="submit"
                      className="rounded-md border border-brand/40 px-2 py-0.5 text-xs font-medium text-brand transition-colors hover:bg-brand hover:text-white"
                    >
                      Mark read
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
