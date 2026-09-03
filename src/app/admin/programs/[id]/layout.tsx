import { notFound } from "next/navigation";

import { TabLinks } from "@/components/ui/segmented";
import { PageTitle } from "@/components/ui/section";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { formatRough } from "@/lib/format";
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

  const [students, mentorPairings] = await Promise.all([
    studentsWithHours({ programId: program.id }),
    prisma.mentorAssignment.findMany({
      where: { programId: program.id },
      select: { mentorId: true },
    }),
  ]);

  const mentorCount = new Set(mentorPairings.map((m) => m.mentorId)).size;
  const remaining = students.reduce((sum, s) => sum + s.remainingMinutes, 0);
  const base = `/admin/programs/${program.id}`;

  return (
    <div className="space-y-5">
      <PageTitle
        backHref="/admin"
        backLabel="Dashboard"
        eyebrow="Program"
        title={program.name}
        subtitle={`${students.length} student${students.length === 1 ? "" : "s"} · ${mentorCount} mentor${mentorCount === 1 ? "" : "s"} · ${formatRough(remaining)} remaining.`}
      />

      <TabLinks
        label="Program sections"
        items={[
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
