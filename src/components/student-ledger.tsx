import { AssignmentsPanel } from "@/components/assignments-panel";
import { MeetingsLog } from "@/components/meetings-log";
import type { SelectOption } from "@/components/select";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { formatHours } from "@/lib/format";
import type { LedgerAssignment, LedgerSession } from "@/lib/queries";

type Totals = {
  allotted: number;
  completed: number;
  missed: number;
  forfeited: number;
  remaining: number;
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
  manage = false,
  extraStats,
}: {
  sessions: LedgerSession[];
  assignments: LedgerAssignment[];
  totals: Totals;
  studentProfileId: string;
  mentors?: SelectOption[];
  manage?: boolean;
  /** Role-specific numbers appended to the strip (mentor count, total paid). */
  extraStats?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <StatCardGrid>
        <StatCard label="Hours allotted" value={formatHours(totals.allotted)} />
        <StatCard
          label="Hours completed"
          value={formatHours(totals.completed)}
          tone="brand"
        />
        {totals.missed > 0 && (
          <StatCard label="Missed" value={formatHours(totals.missed)} />
        )}
        {totals.forfeited > 0 && (
          <StatCard
            label="Expired unused"
            value={formatHours(totals.forfeited)}
            tone="danger"
          />
        )}
        <StatCard
          label="Hours remaining"
          value={formatHours(totals.remaining)}
          suffix="h"
          tone={totals.remaining < 0 ? "danger" : "default"}
          lead
        />
        {extraStats}
      </StatCardGrid>

      <MeetingsLog sessions={sessions} />

      <AssignmentsPanel
        assignments={assignments}
        studentProfileId={studentProfileId}
        mentors={mentors}
        hoursAllotted={totals.allotted}
        manage={manage}
      />
    </div>
  );
}
