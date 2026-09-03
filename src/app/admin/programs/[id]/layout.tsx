import { notFound } from "next/navigation";

import { ProgramTabs } from "@/components/program-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { formatDuration } from "@/lib/format";
import { monogramOf, programTone } from "@/lib/person-tone";
import { prisma } from "@/lib/prisma";
import { studentsWithHours } from "@/lib/queries";

/**
 * The shell every program page shares: the program's banner in its own hue, and
 * the tabs that split its world into three — what it looks like (Overview), who
 * is in it (Students), how it is set up (Settings).
 *
 * A layout, not a component each page renders, so switching tabs leaves the
 * banner and the tab bar exactly where they are instead of repainting them. It
 * re-runs when an action revalidates, which is what keeps the counts honest.
 */
export default async function ProgramLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireRole(ROLES.ADMIN);
  const { id } = await params;
  const program = await prisma.program.findUnique({ where: { id } });
  if (!program) notFound();

  const [students, mentorPairings, position] = await Promise.all([
    studentsWithHours({ programId: program.id }),
    prisma.mentorAssignment.findMany({
      where: { programId: program.id },
      select: { mentorId: true },
    }),
    // Position in creation order picks this program's hue (see programTone).
    // Program has no createdAt; cuids are timestamp-prefixed, so id order is
    // creation order, and this must match the ranking on the dashboard.
    prisma.program.count({ where: { id: { lt: program.id } } }),
  ]);

  const mentorCount = new Set(mentorPairings.map((m) => m.mentorId)).size;
  const remaining = students.reduce((sum, s) => sum + s.remainingMinutes, 0);
  const base = `/admin/programs/${program.id}`;

  return (
    <div className="space-y-5">
      <PageHeader
        backHref="/admin"
        backLabel="Dashboard"
        eyebrow="Program"
        programTone={programTone(position)}
        monogram={monogramOf(program.name)}
        title={program.name}
        subtitle={`${students.length} student${students.length === 1 ? "" : "s"} · ${mentorCount} mentor${mentorCount === 1 ? "" : "s"} · ${formatDuration(remaining)} still to deliver.`}
      />

      <ProgramTabs
        tabs={[
          { href: base, label: "Overview" },
          {
            href: `${base}/students`,
            label: "Students",
            count: students.length,
          },
          { href: `${base}/settings`, label: "Settings" },
        ]}
      />

      {children}
    </div>
  );
}
