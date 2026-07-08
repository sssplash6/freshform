import { ArrowLink } from "@/components/arrow-link";
import { USER_STATUS } from "@/lib/constants";
import { formatHours } from "@/lib/format";
import type { StudentWithHours } from "@/lib/queries";

/**
 * Students with derived hour totals (allotted = sum of per-mentor
 * allocations). Negative remaining renders red (overdraw is allowed but
 * warned). `manageBase` (admin only) links each row to its detail page where
 * approval and per-mentor allocations live.
 */
export function StudentsTable({
  students,
  showProgram,
  manageBase,
}: {
  students: StudentWithHours[];
  showProgram: boolean;
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
            <th className="px-4 py-3">Cohort</th>
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
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-700">
                      Pending approval
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">{s.user.email}</div>
              </td>
              {showProgram && (
                <td className="px-4 py-3">{s.cohort.program.name}</td>
              )}
              <td className="px-4 py-3">{s.cohort.name}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatHours(s.allottedHours)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatHours(s.completedHours)}
              </td>
              <td
                className={`px-4 py-3 text-right font-medium tabular-nums ${
                  s.remainingHours < 0 ? "text-red-600" : "text-gray-900"
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
