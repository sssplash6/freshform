import "server-only";

import { prisma } from "@/lib/prisma";
import { NOTIFICATION_TYPES, SESSION_STATUS } from "@/lib/constants";
import { formatDate, formatHours } from "@/lib/format";

const UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Lazily generated deadline reminders (no cron on the MVP host): called from
 * the dashboards, it notifies the student AND the mentor once when an
 * allocation's deadline enters the 7-day window, and once more if it passes
 * with hours still unused. `deadlineStage` on the allocation dedupes the
 * sends and is reset whenever an admin changes the deadline.
 */
export async function ensureDeadlineReminders() {
  const now = new Date();
  const soon = new Date(now.getTime() + UPCOMING_WINDOW_MS);

  const due = await prisma.hourAllocation.findMany({
    where: {
      deadline: { not: null, lte: soon },
      OR: [
        { deadlineStage: null },
        { deadlineStage: "UPCOMING_SENT", deadline: { lt: now } },
      ],
    },
    include: {
      mentor: true,
      student: { include: { user: true } },
    },
  });
  if (due.length === 0) return;

  const sums = await prisma.session.groupBy({
    by: ["studentId", "mentorId"],
    where: {
      status: SESSION_STATUS.ACTIVE,
      OR: due.map((a) => ({ studentId: a.studentId, mentorId: a.mentorId })),
    },
    _sum: { hours: true },
  });
  const usedBy = new Map(
    sums.map((s) => [`${s.studentId}:${s.mentorId}`, s._sum.hours ?? 0])
  );

  for (const a of due) {
    const deadline = a.deadline!;
    const passed = deadline.getTime() < now.getTime();
    const remaining = a.hours - (usedBy.get(`${a.studentId}:${a.mentorId}`) ?? 0);
    const mentorLabel = a.mentor.name ?? a.mentor.email;
    const studentLabel = a.student.user.name ?? a.student.user.email;
    const date = formatDate(deadline);

    const stage = passed ? "PASSED_SENT" : "UPCOMING_SENT";
    // Nothing left to use — advance the stage silently, nobody needs a nudge.
    const notify = remaining > 0;

    await prisma.$transaction(async (tx) => {
      // Guard against a concurrent request sending the same reminder.
      const fresh = await tx.hourAllocation.findUnique({
        where: { id: a.id },
        select: { deadlineStage: true },
      });
      if (fresh?.deadlineStage === stage) return;
      await tx.hourAllocation.update({
        where: { id: a.id },
        data: { deadlineStage: stage },
      });
      if (!notify) return;
      await tx.notification.createMany({
        data: [
          {
            userId: a.student.userId,
            type: NOTIFICATION_TYPES.HOURS_DEADLINE,
            message: passed
              ? `The ${date} deadline for your hours with ${mentorLabel} has passed — ${formatHours(remaining)} hours are still unused. Talk to your mentor or the team about what happens next.`
              : `Reminder: use your ${formatHours(remaining)} remaining hours with ${mentorLabel} by ${date}.`,
          },
          {
            userId: a.mentorId,
            type: NOTIFICATION_TYPES.HOURS_DEADLINE,
            message: passed
              ? `${studentLabel} still has ${formatHours(remaining)} unused hours with you past their ${date} deadline.`
              : `${studentLabel} has ${formatHours(remaining)} hours with you to use by ${date} — help them book in time.`,
          },
        ],
      });
    });
  }
}
