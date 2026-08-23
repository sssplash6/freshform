import "server-only";

import { prisma } from "@/lib/prisma";
import { canActAsMentor, SESSION_STATUS, USER_STATUS } from "@/lib/constants";
import { formatDate, formatHours } from "@/lib/format";
import { renderEmail, type Section } from "@/lib/email/layout";
import { appUrl, emailConfigured, sendAll, type Mail } from "@/lib/email/send";
import { unsubscribeUrl } from "@/lib/email/unsubscribe";

/**
 * The Monday hours email: what each person redeemed last week, what is still
 * theirs to redeem, and when it expires.
 *
 * Runs from the weekly Render cron (see render.yaml → /api/cron/weekly-digest).
 * Composition happens entirely up front and mail is sent afterwards, never
 * inside a transaction — see the warning in lib/email/send.ts.
 *
 * Two queries feed every recipient. Calling allocationSummary()/mentorOverview()
 * per person would have been tidier to read and an N+1 of ~3 queries per
 * recipient; at a few hundred students that is a few thousand round trips for a
 * job that needs two. The forfeiture rules below are copied deliberately from
 * lib/hours.ts — one policy, and if it changes there it must change here.
 */

/** A digest looks back one week. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * How far ahead a deadline is called out. Wider than the 7-day in-app reminder
 * on purpose: a weekly email with a 7-day horizon can land the warning a single
 * day before hours expire.
 */
const SOON_MS = 14 * 24 * 60 * 60 * 1000;
/**
 * Don't send twice inside this many days. Guards a re-run, a manual trigger, and
 * two instances firing at once — none of which should mean two emails.
 */
const RESEND_GUARD_MS = 6 * 24 * 60 * 60 * 1000;

type Pairing = {
  studentProfileId: string;
  studentUserId: string;
  studentLabel: string;
  studentActive: boolean;
  /** Null = the student's unassigned pool: hours with no mentor yet. */
  mentorId: string | null;
  mentorLabel: string;
  programName: string;
  allocated: number;
  deadline: Date;
  /** Hours drawn down: delivered plus no-shows, which are charged. */
  used: number;
  /** Hours delivered in the last week only. */
  deliveredThisWeek: number;
  missedThisWeek: number;
  expired: boolean;
  /** Unused hours lost to a passed deadline. */
  forfeited: number;
  /** What is still usable: never positive once the deadline has passed. */
  remaining: number;
};

/** Everything both digests are built from, gathered in two queries. */
async function loadPairings(now: Date): Promise<Pairing[]> {
  const weekAgo = new Date(now.getTime() - WEEK_MS);

  const [allocations, sessions] = await Promise.all([
    prisma.hourAllocation.findMany({
      include: {
        mentor: { select: { id: true, name: true, email: true } },
        student: {
          include: {
            user: { select: { id: true, name: true, email: true, status: true } },
            program: { select: { name: true } },
          },
        },
      },
    }),
    prisma.session.findMany({
      where: { status: SESSION_STATUS.ACTIVE },
      select: {
        studentId: true,
        mentorId: true,
        hours: true,
        attended: true,
        date: true,
      },
    }),
  ]);

  const key = (studentId: string, mentorId: string | null) =>
    `${studentId}:${mentorId}`;
  const used = new Map<string, number>();
  const deliveredWeek = new Map<string, number>();
  const missedWeek = new Map<string, number>();
  const bump = (map: Map<string, number>, k: string, n: number) =>
    map.set(k, (map.get(k) ?? 0) + n);

  for (const s of sessions) {
    const k = key(s.studentId, s.mentorId);
    bump(used, k, s.hours);
    if (s.date.getTime() >= weekAgo.getTime()) {
      if (s.attended) bump(deliveredWeek, k, s.hours);
      else bump(missedWeek, k, s.hours);
    }
  }

  return allocations.map((a) => {
    const k = key(a.studentId, a.mentorId);
    const drawn = used.get(k) ?? 0;
    const expired = a.deadline.getTime() < now.getTime();
    return {
      studentProfileId: a.studentId,
      studentUserId: a.student.userId,
      studentLabel: a.student.user.name ?? a.student.user.email,
      studentActive: a.student.user.status === USER_STATUS.ACTIVE,
      mentorId: a.mentorId,
      mentorLabel: a.mentor
        ? (a.mentor.name ?? a.mentor.email)
        : "no mentor yet",
      programName: a.student.program.name,
      allocated: a.hours,
      deadline: a.deadline,
      used: drawn,
      deliveredThisWeek: deliveredWeek.get(k) ?? 0,
      missedThisWeek: missedWeek.get(k) ?? 0,
      expired,
      forfeited: expired ? Math.max(0, a.hours - drawn) : 0,
      remaining: expired ? Math.min(0, a.hours - drawn) : a.hours - drawn,
    };
  });
}

const soonest = (a: Pairing, b: Pairing) =>
  a.deadline.getTime() - b.deadline.getTime();

/** "by Aug 19" / "by Aug 19 — 3 days" once it is close. */
function deadlinePhrase(deadline: Date, now: Date): string {
  const days = Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return `expired ${formatDate(deadline)}`;
  if (days === 0) return `expires today, ${formatDate(deadline)}`;
  if (days === 1) return `expires tomorrow, ${formatDate(deadline)}`;
  if (days <= 14) return `by ${formatDate(deadline)} — ${days} days`;
  return `by ${formatDate(deadline)}`;
}

/**
 * The student's own digest, or null when there is nothing worth an email.
 *
 * Silence is a feature: a weekly mail that says "nothing happened, you have no
 * hours" every Monday trains people to filter the one that matters.
 */
function studentDigest(mine: Pairing[], now: Date): Mail | null {
  const live = mine.filter((p) => !p.expired && p.remaining > 0);
  const redeemed = mine.filter((p) => p.deliveredThisWeek > 0 || p.missedThisWeek > 0);
  const justExpired = mine.filter((p) => p.forfeited > 0);
  if (live.length === 0 && redeemed.length === 0 && justExpired.length === 0) {
    return null;
  }

  const totalRemaining = live.reduce((sum, p) => sum + p.remaining, 0);
  const redeemedHours = redeemed.reduce((sum, p) => sum + p.deliveredThisWeek, 0);
  const expiringSoon = live
    .filter((p) => p.deadline.getTime() - now.getTime() <= SOON_MS)
    .sort(soonest);

  const sections: Section[] = [];

  const missedHours = redeemed.reduce((sum, p) => sum + p.missedThisWeek, 0);
  sections.push({
    heading: "Last week",
    lines:
      redeemed.length === 0
        ? ["No sessions were logged for you last week."]
        : [
            // Says both numbers rather than one: a no-show draws hours down too,
            // so "2.5 hours used" while 3.5 left the balance is not the truth.
            missedHours > 0
              ? `${formatHours(redeemedHours)} hours delivered, and ${formatHours(missedHours)}h charged for a missed session.`
              : `${formatHours(redeemedHours)} hours across ${redeemed.length} ${redeemed.length === 1 ? "mentor" : "mentors"}.`,
          ],
    rows: redeemed.map((p) => {
      // A week that was only a no-show would otherwise headline as "0h", which
      // reads like nothing happened when in fact hours were charged.
      const onlyMissed = p.deliveredThisWeek === 0 && p.missedThisWeek > 0;
      return {
        label: p.mentorLabel,
        value: `${formatHours(onlyMissed ? p.missedThisWeek : p.deliveredThisWeek)}h`,
        muted: onlyMissed
          ? "charged for a missed session"
          : p.missedThisWeek > 0
            ? `plus ${formatHours(p.missedThisWeek)}h charged for a missed session`
            : undefined,
        tone: onlyMissed ? ("urgent" as const) : undefined,
      };
    }),
  });

  if (live.length > 0) {
    sections.push({
      heading: "Still yours to use",
      lines: [`${formatHours(totalRemaining)} hours in total.`],
      rows: [...live].sort(soonest).map((p) => ({
        label: p.mentorLabel,
        value: `${formatHours(p.remaining)}h`,
        muted: deadlinePhrase(p.deadline, now),
        // Expiring, not lost — amber. Red below is for hours already gone.
        tone:
          p.deadline.getTime() - now.getTime() <= SOON_MS
            ? ("urgent" as const)
            : undefined,
      })),
    });
  }

  if (justExpired.length > 0) {
    sections.push({
      heading: "Expired unused",
      lines: [
        "These hours passed their deadline and can no longer be booked. Talk to your program contact if you think that's wrong.",
      ],
      rows: justExpired.map((p) => ({
        label: p.mentorLabel,
        value: `${formatHours(p.forfeited)}h`,
        muted: `deadline was ${formatDate(p.deadline)}`,
        tone: "lost" as const,
      })),
    });
  }

  const urgent = expiringSoon[0];
  const subject = urgent
    ? `${formatHours(urgent.remaining)}h with ${urgent.mentorLabel} ${deadlinePhrase(urgent.deadline, now)}`
    : totalRemaining > 0
      ? `You have ${formatHours(totalRemaining)} hours left to book`
      : "Your hours last week";

  const to = mine[0];
  const { html, text } = renderEmail({
    preheader: urgent
      ? `Book them before ${formatDate(urgent.deadline)}.`
      : `${formatHours(totalRemaining)} hours still available.`,
    title: subject,
    intro: `Your mentoring hours in ${to.programName}, as of ${formatDate(now)}.`,
    sections,
    cta:
      live.length > 0
        ? {
            label: "Book a session",
            url: `${appUrl()}/student/book`,
            tone: "accent" as const,
          }
        : undefined,
    unsubscribeUrl: unsubscribeUrl(to.studentUserId),
    footerNote: "You're getting this because you have mentoring hours with Freshman Academy.",
  });

  return {
    to: "", // filled in by the caller, which holds the address
    subject,
    html,
    text,
    unsubscribeUrl: unsubscribeUrl(to.studentUserId),
  };
}

/** The mentor's digest: what they delivered, and who is still waiting. */
function mentorDigest(mine: Pairing[], now: Date): Mail | null {
  // `mine` is one mentor's pairings, so the id is never actually null — the
  // unassigned pool belongs to no mentor and can't be in anyone's `mine`.
  const mentorId = mine[0]?.mentorId;
  if (!mentorId) return null;
  const live = mine.filter((p) => !p.expired && p.remaining > 0);
  const logged = mine.filter(
    (p) => p.deliveredThisWeek > 0 || p.missedThisWeek > 0
  );
  const expiringSoon = live
    .filter((p) => p.deadline.getTime() - now.getTime() <= SOON_MS)
    .sort(soonest);
  const justExpired = mine.filter((p) => p.forfeited > 0);
  if (live.length === 0 && logged.length === 0 && justExpired.length === 0) {
    return null;
  }

  const deliveredHours = logged.reduce((sum, p) => sum + p.deliveredThisWeek, 0);
  const missedHours = logged.reduce((sum, p) => sum + p.missedThisWeek, 0);
  const owed = live.reduce((sum, p) => sum + p.remaining, 0);

  const sections: Section[] = [
    {
      heading: "You logged last week",
      lines:
        logged.length === 0
          ? ["No sessions logged last week."]
          : [
              missedHours > 0
                ? `${formatHours(deliveredHours)} hours delivered, and ${formatHours(missedHours)}h charged for a missed session.`
                : `${formatHours(deliveredHours)} hours across ${logged.length} ${logged.length === 1 ? "student" : "students"}.`,
            ],
      rows: logged.map((p) => {
        const onlyMissed = p.deliveredThisWeek === 0 && p.missedThisWeek > 0;
        return {
          label: p.studentLabel,
          value: `${formatHours(onlyMissed ? p.missedThisWeek : p.deliveredThisWeek)}h`,
          muted: onlyMissed
            ? `${p.programName} · no-show, hours still charged`
            : p.missedThisWeek > 0
              ? `${p.programName} · plus ${formatHours(p.missedThisWeek)}h for a no-show`
              : p.programName,
          tone: onlyMissed ? ("urgent" as const) : undefined,
        };
      }),
    },
  ];

  if (live.length > 0) {
    sections.push({
      heading: "Still to deliver",
      lines: [
        `${formatHours(owed)} hours across ${live.length} ${live.length === 1 ? "student" : "students"}, soonest deadline first.`,
      ],
      rows: [...live].sort(soonest).map((p) => ({
        label: p.studentLabel,
        value: `${formatHours(p.remaining)}h`,
        muted: `${p.programName} · ${deadlinePhrase(p.deadline, now)}`,
        tone:
          p.deadline.getTime() - now.getTime() <= SOON_MS
            ? ("urgent" as const)
            : undefined,
      })),
    });
  }

  if (justExpired.length > 0) {
    sections.push({
      heading: "Expired unused",
      lines: [
        "These deadlines passed with hours unspent, so no new sessions can be logged against them.",
      ],
      rows: justExpired.map((p) => ({
        label: p.studentLabel,
        value: `${formatHours(p.forfeited)}h`,
        muted: `deadline was ${formatDate(p.deadline)}`,
        tone: "lost" as const,
      })),
    });
  }

  const subject =
    expiringSoon.length > 0
      ? `${expiringSoon.length} ${expiringSoon.length === 1 ? "student's hours expire" : "students' hours expire"} within two weeks`
      : owed > 0
        ? `${formatHours(owed)} hours still to deliver`
        : "Your week in hours";

  const { html, text } = renderEmail({
    preheader:
      expiringSoon.length > 0
        ? `Soonest: ${expiringSoon[0].studentLabel}, ${formatDate(expiringSoon[0].deadline)}.`
        : `${formatHours(deliveredHours)} hours delivered last week.`,
    title: subject,
    intro: `Your mentoring week, as of ${formatDate(now)}.`,
    sections,
    cta: { label: "Open your dashboard", url: `${appUrl()}/mentor` },
    unsubscribeUrl: unsubscribeUrl(mentorId),
    footerNote: "You're getting this because you mentor students at Freshman Academy.",
  });

  return {
    to: "",
    subject,
    html,
    text,
    unsubscribeUrl: unsubscribeUrl(mentorId),
  };
}

export type DigestResult = {
  live: boolean;
  students: number;
  mentors: number;
  sent: number;
  failed: number;
  skippedRecently: number;
  nothingToSay: number;
  errors: string[];
  /** Only present for a preview run: what would have gone out, unsent. */
  preview?: { to: string; subject: string; html: string; text: string }[];
};

/**
 * Compose and send this week's digests.
 *
 * `only` restricts the run to one address, for a real send to yourself before
 * turning the cron loose on everybody. `preview` composes and returns the mail
 * without sending it or stamping anybody — the way to read what a change to the
 * copy actually produces, against real data, without mailing hundreds of people.
 */
export async function sendWeeklyDigest({
  now = new Date(),
  only,
  force = false,
  preview = false,
}: {
  now?: Date;
  only?: string;
  force?: boolean;
  preview?: boolean;
} = {}): Promise<DigestResult> {
  const pairings = await loadPairings(now);

  const recipients = await prisma.user.findMany({
    where: {
      weeklyDigest: true,
      status: USER_STATUS.ACTIVE,
      ...(only ? { email: only.toLowerCase() } : {}),
    },
    select: {
      id: true,
      email: true,
      role: true,
      isMentor: true,
      digestSentAt: true,
      studentProfile: { select: { id: true } },
    },
  });

  const mails: (Mail & { userId: string })[] = [];
  let skippedRecently = 0;
  let nothingToSay = 0;
  let students = 0;
  let mentors = 0;

  for (const user of recipients) {
    const stamp = user.digestSentAt?.getTime() ?? 0;
    // A preview ignores the guard: it sends nothing, so there is nothing to
    // double-send, and being unable to look at this week's mail because it
    // already went out would defeat the point.
    if (!force && !preview && now.getTime() - stamp < RESEND_GUARD_MS) {
      skippedRecently += 1;
      continue;
    }

    // A dual-role admin-mentor gets the mentor digest; nobody is both here,
    // because a student account never also mentors.
    const asStudent = user.studentProfile
      ? pairings.filter((p) => p.studentProfileId === user.studentProfile!.id)
      : [];
    const asMentor = canActAsMentor(user)
      ? pairings.filter((p) => p.mentorId === user.id)
      : [];

    const mail =
      asStudent.length > 0
        ? studentDigest(asStudent, now)
        : asMentor.length > 0
          ? mentorDigest(asMentor, now)
          : null;

    if (!mail) {
      nothingToSay += 1;
      continue;
    }
    if (asStudent.length > 0) students += 1;
    else mentors += 1;
    mails.push({ ...mail, to: user.email, userId: user.id });
  }

  if (preview) {
    return {
      live: emailConfigured(),
      students,
      mentors,
      sent: 0,
      failed: 0,
      skippedRecently,
      nothingToSay,
      errors: [],
      preview: mails.map((m) => ({
        to: m.to,
        subject: m.subject,
        html: m.html,
        text: m.text,
      })),
    };
  }

  // Stamped one at a time as each send succeeds, so a crash or a rate-limit
  // wall halfway through does not re-mail everyone who already got theirs.
  const { sent, failed, errors } = await sendAll(mails, async (mail) => {
    const userId = (mail as Mail & { userId: string }).userId;
    await prisma.user.update({
      where: { id: userId },
      data: { digestSentAt: now },
    });
  });

  return {
    live: emailConfigured(),
    students,
    mentors,
    sent,
    failed,
    skippedRecently,
    nothingToSay,
    errors,
  };
}
