import { ArrowLink } from "@/components/arrow-link";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Tr, type Column } from "@/components/ui/table";
import { USER_STATUS } from "@/lib/constants";
import { formatHours } from "@/lib/format";
import type { StudentWithHours } from "@/lib/queries";

/**
 * Students with derived hour totals (allotted = sum of per-mentor
 * allocations). Negative remaining renders red (overdraw is allowed but
 * warned). `manageBase` (admin only) links each row to its detail page where
 * approval and per-mentor allocations live. `showCohort` is off for lists
 * scoped to programs without cohorts — programs are flat by default, so the
 * column is opt-in. `framed=false` drops the outer border for tables
 * embedded in a program island box.
 */
export function StudentsTable({
  students,
  showProgram,
  showCohort = false,
  manageBase,
  framed = true,
}: {
  students: StudentWithHours[];
  showProgram: boolean;
  showCohort?: boolean;
  manageBase?: string;
  framed?: boolean;
}) {
  if (students.length === 0) {
    return <EmptyState framed={framed}>No students yet.</EmptyState>;
  }

  const columns: Column[] = [
    { label: "Student" },
    ...(showProgram ? [{ label: "Program" } as Column] : []),
    ...(showCohort ? [{ label: "Cohort" } as Column] : []),
    { label: "Telegram" },
    { label: "Allotted", align: "right" },
    { label: "Completed", align: "right" },
    { label: "Missed", align: "right" },
    { label: "Remaining", align: "right" },
    ...(manageBase ? [{ label: "" } as Column] : []),
  ];

  return (
    <Table columns={columns} framed={framed}>
      {students.map((s) => (
        <Tr key={s.id}>
          <Td>
            <div className="flex items-center gap-2 font-medium text-ink">
              {s.user.name ?? "—"}
              {s.user.status === USER_STATUS.PENDING && (
                <Chip tone="amber">Pending approval</Chip>
              )}
              {s.user.status === USER_STATUS.ACTIVE && !s.telegramUsername && (
                <Chip tone="gray">Hasn&apos;t signed in yet</Chip>
              )}
            </div>
            <div className="text-xs text-muted-fg">{s.user.email}</div>
          </Td>
          {showProgram && <Td>{s.program.name}</Td>}
          {showCohort && <Td>{s.cohort?.name ?? "—"}</Td>}
          <Td>{s.telegramUsername ? `@${s.telegramUsername}` : "—"}</Td>
          <Td align="right" className="tabular-nums">
            {formatHours(s.allottedHours)}
          </Td>
          <Td align="right" className="tabular-nums">
            {formatHours(s.completedHours)}
          </Td>
          <Td
            align="right"
            className={`tabular-nums ${
              s.missedHours > 0 ? "text-amber-700" : "text-muted-fg"
            }`}
          >
            {s.missedHours > 0 ? formatHours(s.missedHours) : "—"}
          </Td>
          <Td
            align="right"
            className={`font-medium tabular-nums ${
              s.remainingHours < 0 ? "text-red-700" : "text-ink"
            }`}
          >
            {formatHours(s.remainingHours)}
          </Td>
          {manageBase && (
            <Td align="right">
              <ArrowLink href={`${manageBase}/${s.id}`} className="text-[13px]">
                Manage
              </ArrowLink>
            </Td>
          )}
        </Tr>
      ))}
    </Table>
  );
}
