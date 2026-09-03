import { notFound, redirect } from "next/navigation";

import { Avatar } from "@/components/avatar";
import { AvatarForm } from "@/components/forms/avatar-form";
import { BookingLinksForm } from "@/components/forms/booking-link-form";
import { OwnNameForm } from "@/components/forms/own-name-form";
import { ArrowUpRightIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { canActAsMentor, ROLES, USER_STATUS } from "@/lib/constants";
import { requireUser } from "@/lib/dal";
import { initials, personBanner } from "@/lib/person-tone";
import { prisma } from "@/lib/prisma";
import { assignmentsForStudentWhere, mentorAssignments } from "@/lib/queries";
import { StatusChip } from "@/components/ui/status-chip";

/** "Global Admissions / Spring 25", or just the program when there's no cohort. */
function labelOf(a: {
  program: { name: string };
  cohort: { name: string } | null;
}): string {
  return a.cohort ? `${a.program.name} / ${a.cohort.name}` : a.program.name;
}

/**
 * One mentor's profile, read by everyone and edited only by its owner.
 *
 * The mentor sets their picture, their name, and the booking link students use
 * for each program they're assigned to. Booking links stay editable on the
 * mentor dashboard too — this page is a second home for them, not a move.
 *
 * WHAT EACH VIEWER SEES is the whole point of the page:
 *   - the mentor themself: everything, editable.
 *   - staff (admin / leader / sales): every pairing, read-only.
 *   - a student: ONLY the pairing that covers their own program or cohort, and
 *     only if one exists — a mentor from a program they're not in 404s, and a
 *     mentor's other programs are never named to them.
 *
 * Deliberately carries NO hours. The delivery record lives on
 * /admin/mentors/[id], where it can be filtered by period and program; a second
 * unfiltered copy here was the same numbers twice.
 */
export default async function MentorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUser();
  const { id } = await params;

  const mentor = await prisma.user.findUnique({ where: { id } });
  // Same pool the mentors list draws from: plain mentors, plus dual-role
  // admins flagged as mentors.
  if (!mentor || !canActAsMentor(mentor)) notFound();

  const isSelf = viewer.id === mentor.id;
  const isStudent = viewer.role === ROLES.STUDENT;

  // The pairings this viewer is allowed to know about.
  let visible;
  if (isStudent) {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: viewer.id },
    });
    // Not onboarded / not approved yet — the home page explains what's next.
    if (!profile || viewer.status !== USER_STATUS.ACTIVE) redirect("/student");

    visible = await prisma.mentorAssignment.findMany({
      where: { mentorId: mentor.id, ...assignmentsForStudentWhere(profile) },
      include: { program: true, cohort: true },
      orderBy: { createdAt: "asc" },
    });
    // A mentor outside this student's program is none of their business —
    // indistinguishable from a mentor who doesn't exist.
    if (visible.length === 0) notFound();
  } else {
    visible = await mentorAssignments(mentor.id);
  }

  const name = mentor.name ?? mentor.email;
  const banner = personBanner(mentor.id);
  const bookable = visible.filter((a) => a.calendlyUrl);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Identity lives in the banner. For a visitor the picture rides in it,
          so the page opens with the mentor's face; for the owner it is left out
          here because the edit panel below shows it next to the upload button,
          and one page does not need two of the same face. */}
      <PageHeader
        backHref={isStudent ? "/student/book" : undefined}
        backLabel={isStudent ? "Book a session" : undefined}
        eyebrow="Mentor"
        title={name}
        subtitle={
          isStudent
            ? `Your mentor in ${visible.map(labelOf).join(", ")}.`
            : [
                visible.length > 0
                  ? visible.map(labelOf).join(" · ")
                  : "Not assigned to a program yet",
                // Staff need the sign-in address to tell two similar names
                // apart; the mentor knows their own.
                ...(isSelf ? [] : [mentor.email]),
              ].join(" · ")
        }
        leading={
          isSelf ? undefined : (
            <Avatar
              person={mentor}
              alt={`${name}'s profile picture`}
              className="h-20 w-20 text-3xl sm:h-24 sm:w-24"
            />
          )
        }
        // The ghost initials say the same thing the picture beside them already
        // does, and a long subtitle runs into them. Only the owner's banner —
        // which carries no picture — keeps the watermark.
        monogram={isSelf ? initials(mentor.name, mentor.email) : undefined}
        programTone={banner}
      />

      {isSelf && (
        <Panel tone="neutral">
          <PanelHeader eyebrow="Yours to edit" title="Picture and name" />
          <div className="space-y-5 p-4 sm:p-5">
            <AvatarForm
              person={{
                id: mentor.id,
                name: mentor.name,
                email: mentor.email,
                avatarUpdatedAt: mentor.avatarUpdatedAt,
              }}
            />
            <div className="border-t border-line pt-5">
              <OwnNameForm defaultName={mentor.name ?? ""} />
            </div>
          </div>
        </Panel>
      )}

      {/* Booking links. Editable for the owner, one scoped link for a student,
          a read-only audit for staff. */}
      {isSelf ? (
        visible.length > 0 ? (
          <BookingLinksForm
            assignments={visible.map((a) => ({
              id: a.id,
              label: labelOf(a),
              calendlyUrl: a.calendlyUrl,
            }))}
          />
        ) : (
          <EmptyState title="No programs yet">
            Once an admin assigns you to a program, its booking link appears
            here for you to set.
          </EmptyState>
        )
      ) : (
        <Panel tone={bookable.length > 0 ? "total" : "neutral"}>
          <PanelHeader
            tone={bookable.length > 0 ? "total" : "neutral"}
            eyebrow="Booking"
            title={isStudent ? "Book a session" : "Booking links"}
            caption={
              isStudent
                ? undefined
                : `${bookable.length} of ${visible.length} set`
            }
          />
          <ul className="divide-y divide-line">
            {visible.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {labelOf(a)}
                  </p>
                  {!isStudent && (
                    <p className="mt-0.5 truncate text-xs text-muted-fg">
                      {a.calendlyUrl ?? "The mentor hasn't set this one yet."}
                    </p>
                  )}
                </div>
                {a.calendlyUrl ? (
                  <a
                    href={a.calendlyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-[15px] font-semibold text-white transition-colors hover:bg-accent-dark"
                  >
                    Book with {mentor.name?.split(" ")[0] ?? "them"}
                    <ArrowUpRightIcon className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                ) : (
                  <StatusChip severity="attention">No booking link yet</StatusChip>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
