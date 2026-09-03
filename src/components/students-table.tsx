import Link from "next/link";
import { FolderIcon, SendIcon } from "@/components/icons";

import { EmptyState } from "@/components/ui/empty-state";
import { ExternalLink } from "@/components/ui/link";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, Td, Tr, type Column } from "@/components/ui/table";
import { USER_STATUS } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import type { StudentWithHours } from "@/lib/queries";

/**
 * Students with derived hour totals (allotted = sum of per-mentor
 * allocations). Negative remaining renders red (overdraw is allowed but
 * warned). `manageBase` (admin only) turns each student's NAME into the link to
 * their page — where approval and per-mentor allocations live — so opening a
 * student is a click on who they are, not on a button at the end of a table that
 * scrolls sideways. `showCohort` is off for lists
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
    { label: "Folder" },
    { label: "Allotted", align: "right" },
    { label: "Completed", align: "right" },
    { label: "Missed", align: "right" },
    { label: "Remaining", align: "right" },
  ];

  return (
    <Table columns={columns} framed={framed}>
      {students.map((s) => (
        <Tr key={s.id}>
          <Td>
            {/* The name is the way in wherever a detail page exists: clicking a
                student should open them, not hunt for the link at the far right
                of a table that scrolls. */}
            <NameCell href={manageBase && `${manageBase}/${s.id}`}>
              <div className="flex items-center gap-2 font-medium text-ink group-hover:text-brand">
                {s.user.name ?? "—"}
                {s.user.status === USER_STATUS.PENDING && (
                  <StatusChip severity="attention">Pending approval</StatusChip>
                )}
                {s.user.status === USER_STATUS.ACTIVE && !s.telegramUsername && (
                  <StatusChip severity="neutral">Hasn&apos;t signed in</StatusChip>
                )}
              </div>
              <div className="text-xs text-muted-fg">{s.user.email}</div>
            </NameCell>
          </Td>
          {showProgram && <Td label="Program">{s.program.name}</Td>}
          {showCohort && <Td label="Cohort">{s.cohort?.name ?? "—"}</Td>}
          <Td label="Telegram">
            {s.telegramUsername ? (
              <ExternalLink variant="chip" href={`https://t.me/${s.telegramUsername}`} icon={<SendIcon className="h-3.5 w-3.5" />} title={`Open @${s.telegramUsername} on Telegram`}>
@{s.telegramUsername}
</ExternalLink>
            ) : (
              <span className="text-muted-fg">—</span>
            )}
          </Td>
          <Td label="Folder">
            {s.folderUrl ? (
              <ExternalLink variant="chip" href={s.folderUrl} icon={<FolderIcon className="h-3.5 w-3.5" />} title="Open the student's folder">
Folder
</ExternalLink>
            ) : (
              <span className="text-muted-fg">—</span>
            )}
          </Td>
          <Td label="Allotted" align="right" className="tabular-nums">
            {formatDuration(s.allottedMinutes)}
          </Td>
          <Td label="Completed" align="right" className="tabular-nums">
            {formatDuration(s.completedMinutes)}
          </Td>
          <Td
            label="Missed"
            align="right"
            className={`tabular-nums ${
              s.missedMinutes > 0 ? "text-warn-ink" : "text-muted-fg"
            }`}
          >
            {s.missedMinutes > 0 ? formatDuration(s.missedMinutes) : "—"}
          </Td>
          <Td
            label="Remaining"
            align="right"
            className={`font-medium tabular-nums ${
              s.remainingMinutes < 0 ? "text-danger-ink" : "text-ink"
            }`}
          >
            {formatDuration(s.remainingMinutes)}
          </Td>
        </Tr>
      ))}
    </Table>
  );
}

/** The student's name and email, linked when there's a page to link to. */
function NameCell({
  href,
  children,
}: {
  href?: string | false;
  children: React.ReactNode;
}) {
  if (!href) return <div>{children}</div>;
  return (
    <Link href={href} className="group block">
      {children}
    </Link>
  );
}
