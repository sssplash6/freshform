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
 * The right half of the tracking spreadsheet: what each consultant is doing for
 * this student, its hour budget, its timeline and how far along it is. Only an
 * admin writes here, which is what the violet panel tone says — mentors and
 * students read the same rows without the ⋮ controls.
 *
 * Finished rows carry a green wash, the way they were highlighted in the sheet,
 * so the remaining work is what stands out.
 *
 * `hoursAllotted` is the hours actually granted across the student's mentors.
 * Comparing it against the planned total is the whole point of showing both
 * halves on one page: it catches a plan that promises more than was paid for.
 */
export function AssignmentsPanel({
  assignments,
  studentProfileId,
  mentors,
  hoursAllotted,
  manage = false,
}: {
  assignments: LedgerAssignment[];
  studentProfileId: string;
  mentors?: SelectOption[];
  hoursAllotted: number;
  manage?: boolean;
}) {
  const planned = assignments.reduce((sum, a) => sum + (a.hourLimit ?? 0), 0);
  const done = assignments.filter(
    (a) => a.progress === ASSIGNMENT_PROGRESS.DONE,
  ).length;
  const overPlanned = planned > hoursAllotted;

  const columns: Column[] = [
    { label: "Purpose" },
    { label: "Consultant" },
    { label: "Hour limit", align: "right" },
    { label: "Timeline" },
    { label: "Progress" },
    ...(manage ? [{ label: "", align: "right" } as Column] : []),
  ];

  return (
    <Panel tone="plan">
      <PanelHeader
        tone="plan"
        eyebrow="Assigned by an admin"
        title="Assignments"
        caption={
          assignments.length === 0
            ? "Nothing assigned yet"
            : `${done} of ${assignments.length} done · ${formatHours(planned)} hours planned`
        }
      />

      {assignments.length === 0 ? (
        <EmptyState framed={false} title="No assignments yet">
          {manage
            ? "Add the pieces of work this student's consultants are taking on, each with its own hour limit and timeline."
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
                  </Td>
                  <Td>
                    <PersonChip person={a.mentor} size="sm" />
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
                    <Chip tone={PROGRESS_TONE[a.progress] ?? "gray"}>
                      {ASSIGNMENT_PROGRESS_LABELS[a.progress] ?? a.progress}
                    </Chip>
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
                          progress: a.progress,
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
                {formatHours(planned)}
              </span>{" "}
              hours planned against{" "}
              <span className="font-semibold tabular-nums text-ink">
                {formatHours(hoursAllotted)}
              </span>{" "}
              allotted
            </span>
            {overPlanned && (
              <span className="font-medium text-amber-700">
                Planned work exceeds the hours this student holds by{" "}
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
