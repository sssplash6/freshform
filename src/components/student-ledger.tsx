import { AssignmentsPanel } from "@/components/assignments-panel";
import { LedgerBoard } from "@/components/ledger-board";
import type { ViewerContext } from "@/lib/status";
import { MeetingsLog, type ManageMeetings } from "@/components/meetings-log";
import type { OpenTask } from "@/components/forms/task-picker";
import type { SelectOption } from "@/components/select";
import { Figure, FigureRow } from "@/components/ui/figure";
import { formatDuration } from "@/lib/format";
import type { ScheduledMeeting } from "@/lib/interviews";
import type { LedgerAssignment, LedgerSession } from "@/lib/queries";

type Totals = {
  allotted: number;
  completed: number;
  missed: number;
  forfeited: number;
  remaining: number;
  /** Time delivered outside the plan — charged to no allocation. */
  extra: number;
};

/**
 * One student's whole picture, in the order the team reads it: the numbers, the
 * meetings log, then the plan. The log leads because it answers the question
 * that actually comes up in a meeting — what has happened with this student
 * lately — and it is the half that changes most often.
 *
 * `mentors` and `manage` are admin-only; without them the assignments render
 * read-only, which is what mentors and the student see.
 */
export function StudentLedger({
  sessions,
  assignments,
  totals,
  studentProfileId,
  mentors,
  openTasksByMentor,
  showAmountPaid,
  manage = false,
  manageSessions,
  extraStats,
  scheduled,
  mentorBase,
  viewer,
}: {
  sessions: LedgerSession[];
  assignments: LedgerAssignment[];
  totals: Totals;
  studentProfileId: string;
  /** Passed straight through to the board; see LedgerBoard. */
  viewer: ViewerContext;
  mentors?: SelectOption[];
  /** mentorId → their open tasks, for the assign-a-task form (admin only). */
  openTasksByMentor?: Record<string, OpenTask[]>;
  showAmountPaid?: boolean;
  manage?: boolean;
  /** Who may correct rows in the meetings log, if anyone. */
  manageSessions?: ManageMeetings;
  /** Role-specific numbers appended to the strip (mentor count, total paid). */
  extraStats?: React.ReactNode;
  /** The rows behind that panel, so the board can show them beside the log. */
  scheduled?: ScheduledMeeting[];
  /** Base path (admin only) that makes every mentor chip link to their page. */
  mentorBase?: string;
}) {
  return (
    <div className="space-y-6">
      <FigureRow>
        <Figure label="Time allotted" value={formatDuration(totals.allotted)} />
        <Figure
          label="Time completed"
          value={formatDuration(totals.completed)}
          tone="hours"
        />
        {totals.missed > 0 && (
          <Figure label="Missed" value={formatDuration(totals.missed)} />
        )}
        {totals.forfeited > 0 && (
          <Figure
            label="Expired unused"
            value={formatDuration(totals.forfeited)}
            tone="danger"
          />
        )}
        {totals.extra > 0 && (
          <Figure
            label="Extra, beyond plan"
            value={formatDuration(totals.extra)}
            tone="muted"
          />
        )}
        <Figure
          label="Time remaining"
          value={formatDuration(totals.remaining)}
          tone={totals.remaining < 0 ? "danger" : "ink"}
          size="lead"
        />
        {extraStats}
      </FigureRow>

      {/* The spreadsheet's whole tab, side by side and read-only: this is what
          the page is opened for. The panels under it are where rows get
          changed. */}
      <LedgerBoard
        viewer={viewer}
        sessions={sessions}
        meetings={scheduled ?? []}
        assignments={assignments}
        totals={totals}
        mentorBase={mentorBase}
      />

      <MeetingsLog
        sessions={sessions}
        mentorBase={mentorBase}
        manage={manageSessions}
      />

      <AssignmentsPanel
        assignments={assignments}
        studentProfileId={studentProfileId}
        mentors={mentors}
        openTasksByMentor={openTasksByMentor}
        showAmountPaid={showAmountPaid}
        minutesAllotted={totals.allotted}
        manage={manage}
        mentorBase={mentorBase}
      />
    </div>
  );
}
