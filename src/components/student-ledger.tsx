import { AssignmentsPanel } from "@/components/assignments-panel";
import { HoursBreakdown } from "@/components/hours-breakdown";
import { MeetingsLog, type ManageMeetings } from "@/components/meetings-log";
import type { OpenTask } from "@/components/forms/task-picker";
import type { SelectOption } from "@/components/select";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { formatDuration } from "@/lib/format";
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
  meetings,
  mentorBase,
}: {
  sessions: LedgerSession[];
  assignments: LedgerAssignment[];
  totals: Totals;
  studentProfileId: string;
  mentors?: SelectOption[];
  /** mentorId → their open tasks, for the assign-a-task form (admin only). */
  openTasksByMentor?: Record<string, OpenTask[]>;
  showAmountPaid?: boolean;
  manage?: boolean;
  /** Who may correct rows in the meetings log, if anyone. */
  manageSessions?: ManageMeetings;
  /** Role-specific numbers appended to the strip (mentor count, total paid). */
  extraStats?: React.ReactNode;
  /** The scheduled-meetings panel, when the reader gets one. */
  meetings?: React.ReactNode;
  /** Base path (admin only) that makes every mentor chip link to their page. */
  mentorBase?: string;
}) {
  return (
    <div className="space-y-6">
      <StatCardGrid>
        <StatCard label="Time allotted" value={formatDuration(totals.allotted)} />
        <StatCard
          label="Time completed"
          value={formatDuration(totals.completed)}
          tone="brand"
        />
        {totals.missed > 0 && (
          <StatCard label="Missed" value={formatDuration(totals.missed)} />
        )}
        {totals.forfeited > 0 && (
          <StatCard
            label="Expired unused"
            value={formatDuration(totals.forfeited)}
            tone="danger"
          />
        )}
        {totals.extra > 0 && (
          <StatCard
            label="Extra, beyond plan"
            value={formatDuration(totals.extra)}
            tone="muted"
          />
        )}
        <StatCard
          label="Time remaining"
          value={formatDuration(totals.remaining)}
          tone={totals.remaining < 0 ? "danger" : "default"}
          lead
        />
        {extraStats}
      </StatCardGrid>

      {/* The same figures as one bar: the strip says what each number is, this
          says how they sit against each other. */}
      <HoursBreakdown
        allotted={totals.allotted}
        completed={totals.completed}
        missed={totals.missed}
        forfeited={totals.forfeited}
        remaining={totals.remaining}
        extra={totals.extra}
      />

      {meetings}

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
