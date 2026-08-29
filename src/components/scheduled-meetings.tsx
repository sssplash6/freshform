import Link from "next/link";

import { Chip } from "@/components/chip";
import { InterviewResponse } from "@/components/forms/interview-response";
import { InterviewRowActions } from "@/components/forms/interview-row-actions";
import { CalendarIcon, LinkIcon } from "@/components/icons";
import { PersonChip } from "@/components/person-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { INTERVIEW_STATUS, INTERVIEW_STATUS_META } from "@/lib/constants";
import { formatMeetingWhen, formatUntil, toDateInputValue, toTimeInputValue } from "@/lib/format";
import { awaitingAnswer, splitMeetings, type ScheduledMeeting } from "@/lib/interviews";
import { cn } from "@/lib/cn";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * The date as a torn-off calendar leaf. The upcoming list and the completed
 * timeline sit one above the other on the student's page, and this is what
 * makes them unmistakable at a glance: what is coming is a date you can point
 * at, what is done is a rail of dots running backwards.
 */
function DateLeaf({ date, muted }: { date: Date; muted?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border",
        muted
          ? "border-line bg-canvas text-muted-fg"
          : "border-plan-line bg-plan-soft text-plan-ink",
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.08em]">
        {MONTHS_SHORT[date.getUTCMonth()]}
      </span>
      <span className="text-xl font-bold leading-none tabular-nums">
        {date.getUTCDate()}
      </span>
    </div>
  );
}

/** Who is reading, and therefore what they may do about a row. */
export type MeetingsView = "student" | "mentor" | "staff";

function MeetingRow({
  meeting,
  view,
  overdue,
}: {
  meeting: ScheduledMeeting;
  view: MeetingsView;
  overdue?: boolean;
}) {
  const meta = INTERVIEW_STATUS_META[meeting.status];
  const when = formatMeetingWhen(meeting.scheduledAt, meeting.hasTime);

  return (
    <li className="deal-in flex gap-4 px-4 py-4 sm:px-5">
      <DateLeaf date={meeting.scheduledAt} muted={overdue} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="text-[15px] font-semibold text-ink">Interview</span>
          {/* Whoever the reader is NOT: a student sees the mentor, a mentor
              sees the student, and staff watching from outside see both. */}
          {view !== "mentor" && <PersonChip person={meeting.mentor} size="sm" />}
          {view !== "student" && meeting.student && (
            <Link
              href={
                view === "staff"
                  ? `/admin/students/${meeting.student.id}`
                  : `/mentor/students/${meeting.student.id}`
              }
              className="text-sm font-medium text-ink hover:text-brand"
            >
              {meeting.student.user.name ?? meeting.student.user.email}
            </Link>
          )}
          {meta && <Chip tone={meta.tone}>{meta.label}</Chip>}
        </div>

        <p className="mt-1 text-sm text-muted-fg">
          <span className="font-medium text-ink">{when}</span>
          {!overdue && <> · {formatUntil(meeting.scheduledAt)}</>}
          {!meeting.hasTime && (
            <> · time to be confirmed</>
          )}
        </p>

        {meeting.note && (
          <p className="mt-1.5 text-[15px] text-ink">{meeting.note}</p>
        )}

        {meeting.link && (
          <a
            href={meeting.link}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            Join the meeting
          </a>
        )}

        {overdue && (
          <p className="mt-2 text-xs text-amber-700">
            {view === "mentor"
              ? "This one has passed with nothing logged — log the hours below, or cancel it."
              : view === "staff"
                ? "This one has passed with no hours logged against it yet."
                : "This one has passed. Your mentor will log the hours."}
          </p>
        )}

        {view === "student" && !overdue && (
          <div className="mt-3">
            <InterviewResponse
              interviewId={meeting.id}
              status={meeting.status}
            />
          </div>
        )}
      </div>

      {view === "mentor" && (
        <InterviewRowActions
          interview={{
            id: meeting.id,
            date: toDateInputValue(meeting.scheduledAt),
            time: meeting.hasTime ? toTimeInputValue(meeting.scheduledAt) : "",
            link: meeting.link,
            note: meeting.note,
          }}
        />
      )}
    </li>
  );
}

/**
 * What's still to come, opposite the log of what already happened. The plan
 * tone (violet) is the point: it is the same violet as the assignment panel,
 * because both are things somebody intends rather than things that happened,
 * and it keeps the coming meetings visibly apart from the amber log below.
 *
 * A meeting whose day has passed with nothing logged is listed after the
 * upcoming ones rather than hidden: it is the row that most needs somebody to
 * do something about it.
 */
export function ScheduledMeetings({
  meetings,
  view,
  toolbar,
  title = "Coming up",
  emptyBody,
}: {
  meetings: ScheduledMeeting[];
  /** Students answer these, mentors move and cancel them, staff just watch. */
  view: MeetingsView;
  /**
   * The "Schedule an interview" control, on the mentor's side. Its own strip
   * under the header rather than a button in it: the form expands in place, and
   * a header row is the wrong shape to grow four fields inside.
   */
  toolbar?: React.ReactNode;
  title?: string;
  emptyBody?: React.ReactNode;
}) {
  const { upcoming, overdue } = splitMeetings(meetings);
  const unanswered = upcoming.filter(awaitingAnswer).length;
  const confirmed = upcoming.filter(
    (m) => m.status === INTERVIEW_STATUS.CONFIRMED,
  ).length;

  const caption =
    upcoming.length === 0
      ? overdue.length > 0
        ? `${overdue.length} awaiting an outcome`
        : "Nothing scheduled"
      : `${upcoming.length} coming up · ${confirmed} confirmed${
          unanswered > 0 ? ` · ${unanswered} awaiting an answer` : ""
        }`;

  return (
    <Panel tone="plan">
      <PanelHeader
        tone="plan"
        eyebrow="Scheduled ahead"
        title={title}
        caption={caption}
      />

      {toolbar && (
        <div className="border-b border-line px-4 py-3.5 sm:px-5">{toolbar}</div>
      )}

      {upcoming.length === 0 && overdue.length === 0 ? (
        <EmptyState
          framed={false}
          icon={<CalendarIcon />}
          title="No meetings scheduled"
        >
          {emptyBody}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line/60">
          {upcoming.map((m) => (
            <MeetingRow key={m.id} meeting={m} view={view} />
          ))}
          {overdue.map((m) => (
            <MeetingRow key={m.id} meeting={m} view={view} overdue />
          ))}
        </ul>
      )}
    </Panel>
  );
}
