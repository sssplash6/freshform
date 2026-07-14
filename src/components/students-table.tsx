import { ArrowLink } from "@/components/arrow-link";
import { Chip } from "@/components/chip";
import { USER_STATUS } from "@/lib/constants";
import { formatHours } from "@/lib/format";
import type { StudentWithHours } from "@/lib/queries";

/**
 * Students with derived hour totals (allotted = sum of per-mentor
 * allocations). Negative remaining renders red (overdraw is allowed but
 * warned). `manageBase` (admin only) links each row to its detail page where
 * approval and per-mentor allocations live. `showCohort` is off for lists
 * scoped to programs without cohorts.
 */
export function StudentsTable({
  students,
  showProgram,
  showCohort = true,
  manageBase,
}: {
  students: StudentWithHours[];
  showProgram: boolean;
  showCohort?: boolean;
  manageBase?: string;
}) {
  if (students.length === 0) {
    return (
      <p className="rounded-lg border border-mist bg-white p-8 text-[15px] text-gray-500">
        No students yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-mist bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-mist bg-mist/40 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">Student</th>
            {showProgram && <th className="px-4 py-3">Program</th>}
            {showCohort && <th className="px-4 py-3">Cohort</th>}
            <th className="px-4 py-3">Telegram</th>
            <th className="px-4 py-3 text-right">Allotted</th>
            <th className="px-4 py-3 text-right">Completed</th>
            <th className="px-4 py-3 text-right">Remaining</th>
            {manageBase && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-mist/60">
          {students.map((s) => (
            <tr key={s.id} className="transition-colors hover:bg-mist/20">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 font-medium text-gray-900">
                  {s.user.name ?? "—"}
                  {s.user.status === USER_STATUS.PENDING && (
                    <Chip tone="amber">Pending approval</Chip>
                  )}
                </div>
                <div className="text-xs text-gray-500">{s.user.email}</div>
              </td>
              {showProgram && (
                <td className="px-4 py-3">{s.program.name}</td>
              )}
              {showCohort && (
                <td className="px-4 py-3">{s.cohort?.name ?? "—"}</td>
              )}
              <td className="px-4 py-3">
                {s.telegramUsername ? `@${s.telegramUsername}` : "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatHours(s.allottedHours)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatHours(s.completedHours)}
              </td>
              <td
                className={`px-4 py-3 text-right font-medium tabular-nums ${
                  s.remainingHours < 0 ? "text-red-700" : "text-navy"
                }`}
              >
                {formatHours(s.remainingHours)}
              </td>
              {manageBase && (
                <td className="px-4 py-3 text-right">
                  <ArrowLink
                    href={`${manageBase}/${s.id}`}
                    className="text-[13px]"
                  >
                    Manage
                  </ArrowLink>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
