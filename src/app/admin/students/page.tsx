import Link from "next/link";

import { Select } from "@/components/select";
import { StudentsTable } from "@/components/students-table";
import { prisma } from "@/lib/prisma";
import { studentsWithHours } from "@/lib/queries";

/**
 * Every student across programs in one table, filterable by program. Rows
 * link to the student's detail page (approval, per-mentor allocations).
 */
export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string }>;
}) {
  const { program = "" } = await searchParams;

  const [programs, students] = await Promise.all([
    prisma.program.findMany({ orderBy: { name: "asc" } }),
    studentsWithHours(),
  ]);
  const programOptions = programs.map((p) => ({ value: p.id, label: p.name }));

  const filtered = program
    ? students.filter((s) => s.programId === program)
    : students;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Students</h1>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4">
        <label className="block text-sm">
          <span className="text-muted-fg">Program</span>
          <div className="mt-0.5 w-56">
            <Select
              name="program"
              ariaLabel="Filter by program"
              options={programOptions}
              placeholder="All programs"
              defaultValue={program}
              required={false}
            />
          </div>
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          Filter
        </button>
        {program && (
          <Link
            href="/admin/students"
            className="min-h-11 rounded-md border border-line px-4 py-2.5 text-sm font-medium text-muted-fg transition-colors hover:border-brand/40 hover:text-ink"
          >
            Clear
          </Link>
        )}
      </form>

      {filtered.length === 0 && students.length > 0 ? (
        <p className="rounded-lg border border-line bg-surface p-8 text-[15px] text-muted-fg">
          No students in this program yet.
        </p>
      ) : (
        <StudentsTable
          students={filtered}
          showProgram
          showCohort={students.some((s) => s.cohort)}
          manageBase="/admin/students"
        />
      )}
    </div>
  );
}
