import { formatHours } from "@/lib/format";
import { SetHoursForm } from "@/components/forms/set-hours-form";
import type { StudentWithHours } from "@/lib/queries";

/**
 * Students with derived hour totals. Negative remaining renders red
 * (overdraw is allowed but warned). `showAllotmentEditor` is admin-only.
 */
export function StudentsTable({
  students,
  showProgram,
  showAllotmentEditor = false,
}: {
  students: StudentWithHours[];
  showProgram: boolean;
  showAllotmentEditor?: boolean;
}) {
  if (students.length === 0) {
    return (
      <p className="rounded-lg border border-mist bg-white p-6 text-sm text-gray-500">
        No students yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-mist bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-mist bg-mist/40 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Student</th>
            {showProgram && <th className="px-3 py-2">Program</th>}
            <th className="px-3 py-2">Cohort</th>
            <th className="px-3 py-2 text-right">Allotted</th>
            <th className="px-3 py-2 text-right">Completed</th>
            <th className="px-3 py-2 text-right">Remaining</th>
            {showAllotmentEditor && <th className="px-3 py-2">Set allotment</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-mist/60">
          {students.map((s) => (
            <tr key={s.id}>
              <td className="px-3 py-2">
                <div className="font-medium text-gray-900">
                  {s.user.name ?? "—"}
                </div>
                <div className="text-xs text-gray-500">{s.user.email}</div>
              </td>
              {showProgram && (
                <td className="px-3 py-2">{s.cohort.program.name}</td>
              )}
              <td className="px-3 py-2">{s.cohort.name}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatHours(s.allottedHours)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatHours(s.completedHours)}
              </td>
              <td
                className={`px-3 py-2 text-right font-medium tabular-nums ${
                  s.remainingHours < 0 ? "text-red-600" : "text-gray-900"
                }`}
              >
                {formatHours(s.remainingHours)}
              </td>
              {showAllotmentEditor && (
                <td className="px-3 py-2">
                  <SetHoursForm
                    studentProfileId={s.id}
                    currentHours={s.allottedHours}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
