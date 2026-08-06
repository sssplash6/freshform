import { Chip, type ChipTone } from "@/components/chip";
import { PersonChip } from "@/components/person-chip";
import { AddAssignmentForm } from "@/components/forms/add-assignment-form";
import { AssignmentRowActions } from "@/components/forms/assignment-row-actions";
import type { SelectOption } from "@/components/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Tr, type Column } from "@/components/ui/table";
import { ASSIGNMENT_PROGRESS, ASSIGNMENT_PROGRESS_LABELS } from "@/lib/constants";
import { formatHours } from "@/lib/format";
import type { LedgerAssignment } from "@/lib/queries";

const PROGRESS_TONE: Record<string, ChipTone> = {
  NOT_STARTED: "gray",
  IN_PROGRESS: "violet",
  DONE: "green",
};

/**
 * The right half of the tracking spreadsheet: the tasks each consultant is doing
 * for this student, each with its hour budget, its timeline and how far along it
 * is. Tasks are born with the hours an admin allocates for them, and every
 * session a mentor logs names one — so this panel is the plan the meetings log
 * is delivering against. Only an admin writes here, which is what the violet
 * panel tone says; mentors and students read the same rows without the ⋮
 * controls.
 *
 * Finished rows carry a green wash, the way they were highlighted in the sheet,
 * so the remaining work is what stands out. Progress normally follows the hours
 * logged against a task; a row an admin has stated by hand reads "pinned",
 * which is the only reason hours would stop moving it.
 *
 * `hoursAllotted` is the hours actually granted across the student's mentors.
 * Comparing it against the budgeted total is the whole point of showing both
 * halves on one page: it catches a plan that promises more than was paid for.
 */
export function AssignmentsPanel({
  assignments,
  studentProfileId,
  mentors,
  hoursAllotted,
  manage = false,
  mentorBase,
}: {
  assignments: LedgerAssignment[];
  studentProfileId: string;
  mentors?: SelectOption[];
  hoursAllotted: number;
  manage?: boolean;
  /** Base path (admin only) that makes each Consultant chip link to them. */
  mentorBase?: string;
}) {
  const planned = assignments.reduce((sum, a) => sum + (a.hourLimit ?? 0), 0);
  const logged = assignments.reduce((sum, a) => sum + a.loggedHours, 0);
  const done = assignments.filter(
    (a) => a.progress === ASSIGNMENT_PROGRESS.DONE,
  ).length;
  const overPlanned = planned > hoursAllotted;

  const columns: Column[] = [
    { label: "Task" },
    { label: "Consultant" },
    { label: "Logged", align: "right" },
    { label: "Budget", align: "right" },
    { label: "Timeline" },
    { label: "Progress" },
    ...(manage ? [{ label: "", align: "right" } as Column] : []),
  ];

  return (
    <Panel tone="plan">
      <PanelHeader
        tone="plan"
        eyebrow="What the hours are for"
        title="Tasks"
        caption={
          assignments.length === 0
            ? "Nothing assigned yet"
            : `${done} of ${assignments.length} done · ${formatHours(planned)} hours budgeted`
        }
      />

      {assignments.length === 0 ? (
        <EmptyState framed={false} title="No tasks yet">
          {manage
            ? "Allocate hours to a mentor and the task those hours are for lands here — or assign a task now and fund it later."
            : "An admin sets out the work planned for this student here."}
        </EmptyState>
      ) : (
        <>
          <Table framed={false} columns={columns}>
            {assignments.map((a, i) => {
              const isDone = a.progress === ASSIGNMENT_PROGRESS.DONE;
              return (
                <Tr
                  key={a.id}
                  className={`deal-in ${isDone ? "bg-green-50/50" : ""}`}
                  style={{ animationDelay: `${Math.min(i, 14) * 24}ms` }}
                >
                  <Td className="max-w-xs">
                    <span className="font-medium text-ink">{a.purpose}</span>
                    {/* What a person said about this task that its state can't
                        carry — a missed hour, an open question. */}
                    {a.note && (
                      <span className="mt-0.5 block text-xs text-muted-fg">
                        {a.note}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <PersonChip
                      person={a.mentor}
                      size="sm"
                      href={mentorBase && `${mentorBase}/${a.mentor.id}`}
                    />
                  </Td>
                  {/* Hours mentors actually logged against this task. Amber once
                      they pass the budget: overspend is warned, never blocked. */}
                  <Td
                    align="right"
                    className={`tabular-nums ${
                      a.hourLimit != null && a.loggedHours > a.hourLimit
                        ? "font-semibold text-amber-700"
                        : a.loggedHours > 0
                          ? "text-ink"
                          : "text-muted-fg"
                    }`}
                  >
                    {a.loggedHours > 0 ? formatHours(a.loggedHours) : "—"}
                  </Td>
                  <Td align="right" className="font-semibold tabular-nums text-ink">
                    {a.hourLimit == null ? (
                      <span className="font-normal text-muted-fg">—</span>
                    ) : (
                      formatHours(a.hourLimit)
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {a.timeline ?? <span className="text-muted-fg">—</span>}
                  </Td>
                  <Td>
                    <span className="flex items-center gap-1.5">
                      <Chip tone={PROGRESS_TONE[a.progress] ?? "gray"}>
                        {ASSIGNMENT_PROGRESS_LABELS[a.progress] ?? a.progress}
                      </Chip>
                      {a.progressManual && (
                        <span
                          title="Set by hand — logged hours no longer move this"
                          aria-label="Set by hand"
                          className="text-[11px] text-muted-fg"
                        >
                          pinned
                        </span>
                      )}
                    </span>
                  </Td>
                  {manage && (
                    <Td align="right">
                      <AssignmentRowActions
                        assignment={{
                          id: a.id,
                          purpose: a.purpose,
                          mentorId: a.mentorId,
                          hourLimit: a.hourLimit,
                          timeline: a.timeline,
                          note: a.note,
                          progress: a.progress,
                          progressManual: a.progressManual,
                        }}
                        mentors={mentors ?? []}
                      />
                    </Td>
                  )}
                </Tr>
              );
            })}
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line bg-canvas px-4 py-3 text-xs sm:px-5">
            <span className="text-muted-fg">
              <span className="font-semibold tabular-nums text-ink">
                {formatHours(logged)}
              </span>{" "}
              hours logged against{" "}
              <span className="font-semibold tabular-nums text-ink">
                {formatHours(planned)}
              </span>{" "}
              budgeted, of{" "}
              <span className="font-semibold tabular-nums text-ink">
                {formatHours(hoursAllotted)}
              </span>{" "}
              allotted
            </span>
            {overPlanned && (
              <span className="font-medium text-amber-700">
                Budgeted work exceeds the hours this student holds by{" "}
                {formatHours(planned - hoursAllotted)}.
              </span>
            )}
          </div>
        </>
      )}

      {manage && mentors && mentors.length > 0 && (
        <div className="border-t border-line px-4 py-4 sm:px-5">
          <AddAssignmentForm
            studentProfileId={studentProfileId}
            mentors={mentors}
          />
        </div>
      )}
    </Panel>
  );
}
