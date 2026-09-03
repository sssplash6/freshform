import Link from "next/link";

import { ArrowRightIcon, LinkIcon } from "@/components/icons";
import { ExpandableText } from "@/components/expandable-text";
import { PersonChip } from "@/components/person-chip";
import { Eyebrow, Section } from "@/components/ui/section";
import { ExternalLink } from "@/components/ui/link";
import { StatusChip } from "@/components/ui/status-chip";
import type { Status } from "@/lib/status";
import {
  BUCKET_LABEL,
  bucketOf,
  formatDay,
  formatTimeOfDay,
  type Bucket,
} from "@/lib/when";

/**
 * "Up next" — everything with a date on it, in one list.
 *
 * Three separate lists used to answer one question. Meetings were in
 * `ScheduledMeetings` with a 56px violet calendar leaf per row; use-by dates
 * were a column in a table on another page; task due dates were a chip inside
 * a panel. A mentor asking "what is happening this week" had to visit three
 * places and merge them mentally.
 *
 * The rows are heterogeneous on purpose. What a reader wants from this section
 * is chronology, and a deadline three days out matters more than a meeting next
 * month regardless of which of the two is a "meeting".
 *
 * The `DateLeaf` is gone with the three lists. A torn calendar page per row is
 * 56px of decoration repeating the group header directly above it, and on a
 * phone it took a third of the row's width.
 */
export type TimelineEntry = {
  id: string;
  /** The program's wall clock, as `Interview.scheduledAt` stores it. */
  at: Date;
  /** False for a whole-day thing — a use-by date, a task due date. */
  hasTime: boolean;
  /** What it is, in two or three words: "Interview", "Time expires". */
  title: string;
  /** Already in this reader's voice, from `lib/status.ts`. */
  status?: Status | null;
  /** Whoever the reader is NOT: a student sees the mentor, a mentor the student. */
  person?: { id: string; name: string | null; email: string } | null;
  /** Where the row goes when tapped. */
  href?: string;
  /** A call link — the one thing on this page a reader needs mid-meeting. */
  joinUrl?: string | null;
  note?: string | null;
  /** Move · Cancel · Log · an RSVP. Only for rows this viewer owns. */
  action?: React.ReactNode;
};

const ORDER: Bucket[] = ["overdue", "today", "week", "later"];

export function Timeline({
  entries,
  now,
  title = "Up next",
  /** Which buckets to render. `later` is usually a link, not a list. */
  buckets = ["overdue", "today", "week"],
  limit,
  moreHref,
  moreLabel = "All scheduled",
  empty = "Nothing scheduled.",
  className,
}: {
  entries: TimelineEntry[];
  /** One instant for the whole list, so two rows cannot disagree about today. */
  now: Date;
  title?: string;
  buckets?: Bucket[];
  limit?: number;
  moreHref?: string;
  moreLabel?: string;
  empty?: React.ReactNode;
  className?: string;
}) {
  const shown = ORDER.filter((b) => buckets.includes(b));
  const grouped = new Map<Bucket, TimelineEntry[]>();
  for (const entry of entries) {
    const bucket = bucketOf(entry.at, now);
    if (!shown.includes(bucket)) continue;
    const group = grouped.get(bucket);
    if (group) group.push(entry);
    else grouped.set(bucket, [entry]);
  }

  let remaining = limit ?? Infinity;
  const total = [...grouped.values()].reduce((n, g) => n + g.length, 0);
  const hidden = limit != null ? Math.max(0, total - limit) : 0;

  return (
    <Section
      title={title}
      className={className}
      action={
        moreHref ? (
          <Link href={moreHref} className="text-xs font-medium text-brand hover:underline">
            {hidden > 0 ? `${hidden} more · ${moreLabel}` : moreLabel}
          </Link>
        ) : undefined
      }
    >
      {total === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-fg sm:px-5">{empty}</p>
      ) : (
        shown.map((bucket) => {
          const group = grouped.get(bucket);
          if (!group || remaining <= 0) return null;
          // Overdue and today come first, so a cap can only ever cut the tail.
          const rows = group.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, remaining);
          remaining -= rows.length;
          return (
            <div key={bucket}>
              <div className="border-b border-line bg-canvas/60 px-4 py-1.5 sm:px-5">
                <Eyebrow>{BUCKET_LABEL[bucket]}</Eyebrow>
              </div>
              <ul className="divide-y divide-line">
                {rows.map((entry) => (
                  <TimelineItem key={entry.id} entry={entry} now={now} bucket={bucket} />
                ))}
              </ul>
            </div>
          );
        })
      )}
    </Section>
  );
}

/**
 * One dated row: when · what · who · state · what to do.
 *
 * The day is repeated on the row even under a "Today" header, because a
 * "Next 7 days" group needs it and a reader should not have to notice which
 * group they are in to read a row.
 */
export function TimelineItem({
  entry,
  now,
  bucket,
}: {
  entry: TimelineEntry;
  now: Date;
  bucket?: Bucket;
}) {
  const { title, status, person, href, joinUrl, note, action, at, hasTime } = entry;
  const day = formatDay(at, now);
  const time = formatTimeOfDay(at, hasTime);
  const inferred = bucket ?? bucketOf(at, now);

  const when = (
    <span className="w-[7.5rem] shrink-0 text-[13px] leading-snug sm:w-36">
      <span className="block font-semibold text-ink">{day}</span>
      {/* No time on a whole-day row rather than a fake 00:00, and the zone is
          named: a student who moved abroad reads the same digits as the mentor
          who typed them, and only one of them is right about local noon. */}
      <span className="block text-muted-fg">{time ?? "All day"}</span>
    </span>
  );

  const body = (
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[15px] font-medium text-ink">{title}</span>
        {person && <PersonChip person={person} size="sm" />}
        {status && <StatusChip status={status} />}
      </span>
      {note && (
        <span className="mt-1 block text-[13px] text-muted-fg">
          <ExpandableText text={note} lines={2} />
        </span>
      )}
      {joinUrl && (
        <ExternalLink
          href={joinUrl}
          icon={<LinkIcon className="h-3.5 w-3.5" />}
          className="mt-0.5"
        >
          Join the meeting
        </ExternalLink>
      )}
    </span>
  );

  return (
    <li
      className={
        "flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 sm:px-5" +
        // An overdue row is the only one that is not simply information. It
        // gets a left edge, not a tinted panel: the status chip already carries
        // the colour, and a whole amber row for every stale meeting was the
        // wall of warning this section replaces.
        (inferred === "overdue" ? " border-l-2 border-l-warn-line" : "")
      }
    >
      {href && !action ? (
        <Link href={href} className="group flex min-w-0 flex-1 items-start gap-4">
          {when}
          {body}
          <ArrowRightIcon className="mt-1 h-4 w-4 shrink-0 text-muted-fg transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
        </Link>
      ) : (
        <>
          {when}
          {body}
        </>
      )}
      {action && <span className="flex shrink-0 items-center gap-2">{action}</span>}
    </li>
  );
}
