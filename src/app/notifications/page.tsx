import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { requireUser } from "@/lib/dal";
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
        <h1 className="text-xl font-semibold text-navy">Notifications</h1>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-md border border-navy px-3 py-1.5 text-xs font-medium text-navy transition-colors hover:bg-navy hover:text-white"
            >
              Mark all read ({unread})
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-lg border border-mist bg-white p-6 text-sm text-gray-500">
          Nothing yet. You&apos;ll be notified here whenever your hours change.
        </p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border p-3 text-sm ${
                n.read
                  ? "border-mist bg-white text-gray-600"
                  : "border-brand/40 bg-brand/5 text-gray-900"
              }`}
            >
              <p>{n.message}</p>
              <p className="mt-1 text-xs text-gray-400">
                {n.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
