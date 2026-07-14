import { ArrowLink } from "@/components/arrow-link";
import { ApproveStudentButtons } from "@/components/forms/approve-student-buttons";
import { CreateStudentForm } from "@/components/forms/create-student-form";
import { StudentsTable } from "@/components/students-table";
import { USER_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import {
  programOptions,
  studentsWithHours,
  toProgramOptions,
} from "@/lib/queries";

export default async function AdminStudentsPage() {
  const [programs, students] = await Promise.all([
    programOptions(),
    studentsWithHours(),
  ]);
  const pending = students.filter(
    (s) => s.user.status === USER_STATUS.PENDING
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-navy">Students</h1>

      {pending.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-800">
            Pending approvals ({pending.length})
          </h2>
          <p className="mt-1 text-xs text-amber-700">
            These students signed up themselves. Approve them, then allocate
            their hours from mentors in their program via “Manage”.
          </p>
          <ul className="mt-3 divide-y divide-amber-200">
            {pending.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {s.user.name ?? s.user.email}
                  </div>
                  <div className="text-xs text-gray-500">
                    {s.user.email} · {s.program.name}
                    {s.cohort ? ` / ${s.cohort.name}` : ""}
                    {s.telegramUsername ? ` · @${s.telegramUsername}` : ""} ·
                    signed up {formatDate(s.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ApproveStudentButtons studentProfileId={s.id} />
                  <ArrowLink
                    href={`/admin/students/${s.id}`}
                    className="text-[13px]"
                  >
                    Manage
                  </ArrowLink>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CreateStudentForm programs={toProgramOptions(programs)} />
      <StudentsTable
        students={students}
        showProgram
        manageBase="/admin/students"
      />
    </div>
  );
}
