import { NotificationList } from "@/components/notification-list";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  NOTIFICATION_CATEGORY,
  NOTIFICATION_CATEGORY_LABELS,
  type NotificationCategory,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/section";
import { Section } from "@/components/ui/section";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/** A page of the feed. Deliberately generous — it is read by scrolling. */
const PER_PAGE = 50;

/** The order the chips read in: what changes most often, first. */
const CATEGORY_ORDER: NotificationCategory[] = [
  NOTIFICATION_CATEGORY.SESSIONS,
  NOTIFICATION_CATEGORY.MEETINGS,
  NOTIFICATION_CATEGORY.HOURS,
  NOTIFICATION_CATEGORY.TASKS,
  NOTIFICATION_CATEGORY.DEADLINES,
  NOTIFICATION_CATEGORY.ACCOUNTS,
];

function isCategory(value: unknown): value is NotificationCategory {
  return (
    typeof value === "string" &&
    (CATEGORY_ORDER as string[]).includes(value)
  );
}

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
  searchParams: Promise<{ page?: string; category?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const page = parsePage(params.page);

  // A filter of six, not of seventeen types. Anything else in the URL narrows
  // to nothing rather than widening the read — the params never decide reach.
  const wanted = params.category;
  const category = isCategory(wanted) ? wanted : undefined;
  const where = { userId: user.id, ...(category ? { category } : {}) };

  // The feed used to stop dead at the hundredth notification with nothing to
  // say so: older history simply did not exist as far as the page was
  // concerned. It is paged now, and the unread badge counts every unread one
  // rather than the unread ones that happened to be on screen.
  const [notifications, total, unread, byCategory] = await Promise.all([
    prisma.notification.findMany({
      where,
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
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
    // Counted across the whole feed, not the filtered slice: a chip reading
    // zero is what tells a reader the category exists and is empty.
    prisma.notification.groupBy({
      by: ["category"],
      where: { userId: user.id },
      _count: true,
    }),
  ]);
  const countOf = new Map(byCategory.map((c) => [c.category, c._count]));
  const blurb = BLURB[user.role] ?? "Everything that changed for you.";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle
        eyebrow={unread > 0 ? `${unread} unread` : "All caught up"}
        title="Notifications"
        subtitle={blurb}
      />

      <FilterBar
        basePath="/notifications"
        params={params}
        // No "All" chip: a chip that is on clears itself when clicked, and the
        // bar's own Reset is the way back from any of them. Categories a reader
        // has nothing in are dropped rather than offered empty.
        presets={CATEGORY_ORDER.filter((c) => countOf.has(c)).map((c) => ({
          label: NOTIFICATION_CATEGORY_LABELS[c],
          params: { category: c },
        }))}
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
              params={category ? { category } : {}}
              page={page}
              pageSize={PER_PAGE}
              total={total}
              unit="notifications"
              className="border-t border-line px-4 py-3 sm:px-5"
            />
          </>
        )}
      </Section>

    </div>
  );
}
