import { NotificationList } from "@/components/notification-list";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { setWeeklyDigest } from "@/lib/actions/email-prefs";
import { ROLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/section";
import { Section } from "@/components/ui/section";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/** A page of the feed. Deliberately generous — it is read by scrolling. */
const PER_PAGE = 50;

/** What this feed is for, in the words of the person reading it. */
const BLURB: Record<string, string> = {
  ADMIN:
    "Sessions your mentors log, tasks they finish, signups waiting on approval, and every change to a student's time.",
  DEPT_LEADER: "Changes to students and across your program.",
  SALES: "Changes to students and across your program.",
  MENTOR:
    "Tasks an admin assigns you, time granted for your students, and deadlines coming up.",
  STUDENT:
    "Every session your mentors log, every change to your time, and deadlines before they pass.",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const page = parsePage((await searchParams).page);

  // The feed used to stop dead at the hundredth notification with nothing to
  // say so: older history simply did not exist as far as the page was
  // concerned. It is paged now, and the unread badge counts every unread one
  // rather than the unread ones that happened to be on screen.
  const [notifications, total, unread] = await Promise.all([
    prisma.notification.findMany({
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
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.notification.count({ where: { userId: user.id } }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  const blurb = BLURB[user.role] ?? "Everything that changed for you.";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle
        eyebrow={unread > 0 ? `${unread} unread` : "All caught up"}
        title="Notifications"
        subtitle={blurb}
      />

      <Section
          eyebrow=""
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
      >

        {notifications.length === 0 ? (
          <EmptyState framed={false} title="Nothing has happened yet">
            {blurb} Changes to time, sessions and deadlines arrive here.
          </EmptyState>
        ) : (
          <>
            <NotificationList notifications={notifications} />
            <Pagination
              basePath="/notifications"
              params={{}}
              page={page}
              pageSize={PER_PAGE}
              total={total}
              unit="notifications"
              className="border-t border-line px-4 py-3 sm:px-5"
            />
          </>
        )}
      </Section>

      {/* The signed-in way to switch the weekly email off. The other way is the
          link in its own footer, for people who won't sign in to say stop. */}
      <Section eyebrow="By email" title="Weekly time summary"
      >
        <form
          action={setWeeklyDigest}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4 sm:p-5"
        >
          <label className="flex max-w-lg items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="weeklyDigest"
              defaultChecked={user.weeklyDigest}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
            />
            <span className="text-muted-fg">
              Every Monday, a summary of the hours{" "}
              {user.role === ROLES.STUDENT
                ? "you used last week and the time you still have to book, with their deadlines."
                : "delivered last week and the remaining, with the deadlines they fall under."}
            </span>
          </label>
          <Button type="submit" variant="secondary" size="sm">
            Save
          </Button>
        </form>
      </Section>
    </div>
  );
}
