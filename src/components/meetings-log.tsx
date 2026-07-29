import { Chip } from "@/components/chip";
import { PersonChip } from "@/components/person-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Tr } from "@/components/ui/table";
import { SESSION_STATUS } from "@/lib/constants";
import { formatDate, formatHours } from "@/lib/format";
import type { LedgerSession } from "@/lib/queries";

/**
 * The left half of the tracking spreadsheet: every meeting a mentor logged for
 * this student, in the sheet's own column order (who, how long, when, what was
 * covered). Mentors own this data by logging sessions, which is what the amber
 * panel tone says.
 *
 * Voided sessions stay listed but greyed with a struck-through duration: they
 * are part of the history even though their hours went back.
 */
export function MeetingsLog({ sessions }: { sessions: LedgerSession[] }) {
  const active = sessions.filter((s) => s.status === SESSION_STATUS.ACTIVE);
  const loggedHours = active.reduce((sum, s) => sum + s.hours, 0);

  return (
    <Panel tone="log">
      <PanelHeader
        tone="log"
        eyebrow="Logged by mentors"
        title="Meetings log"
        caption={
          active.length === 0
            ? "Nothing logged yet"
            : `${active.length} meeting${active.length === 1 ? "" : "s"} · ${formatHours(loggedHours)} hours`
        }
      />

      {sessions.length === 0 ? (
        <EmptyState framed={false} title="No meetings logged yet">
          Every session a mentor logs for this student shows up here, newest
          first.
        </EmptyState>
      ) : (
        <Table
          framed={false}
          columns={[
            { label: "Team" },
            { label: "Duration", align: "right" },
            { label: "Date" },
            { label: "Notes" },
          ]}
        >
          {sessions.map((s, i) => {
            const voided = s.status === SESSION_STATUS.VOIDED;
            return (
              <Tr
                key={s.id}
                className="deal-in"
                style={{ animationDelay: `${Math.min(i, 14) * 24}ms` }}
              >
                <Td className={voided ? "opacity-45" : undefined}>
                  <PersonChip person={s.mentor} size="sm" />
                </Td>
                <Td align="right">
                  <span
                    className={
                      voided
                        ? "text-muted-fg line-through tabular-nums"
                        : "font-semibold tabular-nums text-ink"
                    }
                  >
                    {formatHours(s.hours)}
                  </span>
                </Td>
                <Td
                  className={`whitespace-nowrap tabular-nums ${voided ? "text-muted-fg" : "text-ink"}`}
                >
                  {formatDate(s.date)}
                </Td>
                <Td className="max-w-md">
                  <div className={voided ? "opacity-55" : undefined}>
                    {s.task ? (
                      <div className="text-ink">{s.task}</div>
                    ) : (
                      !s.note && <span className="text-muted-fg">—</span>
                    )}
                    {s.note && (
                      <div className={s.task ? "text-xs text-muted-fg" : "text-ink"}>
                        {s.note}
                      </div>
                    )}
                  </div>
                  {(voided || !s.attended) && (
                    <div className="mt-1.5">
                      {voided ? (
                        <Chip tone="gray">Voided, hours returned</Chip>
                      ) : (
                        <Chip tone="amber">No-show, hours still charged</Chip>
                      )}
                    </div>
                  )}
                </Td>
              </Tr>
            );
          })}
        </Table>
      )}
    </Panel>
  );
}
