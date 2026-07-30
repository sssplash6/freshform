import "server-only";

import { prisma } from "@/lib/prisma";
import { ROLES, type NotificationType } from "@/lib/constants";

/**
 * The one way notifications get written. Producers used to call
 * `tx.notification.create` by hand, which is why some events told nobody and
 * none of them carried a destination: each new notice was a fresh chance to
 * forget a recipient or a link.
 *
 * Accepts either the client or a transaction client, so a notification can be
 * written inside the same transaction as the thing it describes.
 */

/** The subset of PrismaClient this module needs, so a tx satisfies it too. */
type Writer = {
  notification: {
    createMany: (args: {
      data: {
        userId: string;
        type: string;
        message: string;
        href?: string | null;
        actorId?: string | null;
      }[];
    }) => Promise<unknown>;
  };
};

type Notice = {
  /** Recipients. Duplicates and the actor themself are dropped. */
  to: string[];
  type: NotificationType;
  message: string;
  /** Where this is ABOUT — the page a reader would go to next. */
  href?: string;
  /** Who did it, when it was a person. */
  actorId?: string;
};

/**
 * Write one notice to many recipients. Nobody is ever notified about their own
 * action: an admin who assigns a goal does not need telling, and it would push
 * genuine news down the list.
 */
export async function notify(db: Writer, notice: Notice): Promise<void> {
  const recipients = [...new Set(notice.to)].filter(
    (id) => id && id !== notice.actorId
  );
  if (recipients.length === 0) return;

  await db.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: notice.type,
      message: notice.message,
      href: notice.href ?? null,
      actorId: notice.actorId ?? null,
    })),
  });
}

/**
 * Every admin, for events the whole staff should see (a session logged, work
 * finished). Kept as a query rather than a cached list so an admin added today
 * starts receiving notices immediately.
 *
 * Dual-role admins are included: they are admins first, and an admin-mentor
 * logging their own session is filtered out by `notify` as the actor anyway.
 */
export async function adminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: ROLES.ADMIN },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

/** Canonical destinations, so producers don't hand-build path strings. */
export const notificationHref = {
  adminStudent: (studentProfileId: string) =>
    `/admin/students/${studentProfileId}`,
  mentorStudent: (studentProfileId: string) =>
    `/mentor/students/${studentProfileId}`,
  studentHome: () => "/student",
  mentorHome: () => "/mentor",
  mentorSessions: () => "/mentor/sessions",
  adminProgram: (programId: string) => `/admin/programs/${programId}`,
};
