import { notFound } from "next/navigation";
import { FolderIcon, SendIcon } from "@/components/icons";

import { ArrowLink, ExternalLink } from "@/components/ui/link";
import { AssignmentsPanel } from "@/components/assignments-panel";
import { LogSessionForm } from "@/components/forms/log-session-form";
import { ScheduleInterviewForm } from "@/components/forms/schedule-interview-form";
import { HoursBreakdown } from "@/components/hours-breakdown";
import { MeetingsLog } from "@/components/meetings-log";
import { ScheduledMeetings } from "@/components/scheduled-meetings";
import { Figure, FigureRow } from "@/components/ui/figure";
import { Callout } from "@/components/ui/callout";
import { PageTitle } from "@/components/ui/section";
import {
  ASSIGNMENT_PROGRESS,
  chargesAllocation,
  ROLES,
  SESSION_STATUS,
  USER_STATUS,
} from "@/lib/constants";
import { requireMentor } from "@/lib/dal";
import { deadlinePassed } from "@/lib/deadlines";
import { formatDate, formatDuration } from "@/lib/format";
import { allocationSummary } from "@/lib/hours";
import { prisma } from "@/lib/prisma";
import {
  studentLedger,
  studentMeetings,
  taskOptionsForSessions,
} from "@/lib/queries";
import { DeadlineText, StatusChip } from "@/components/ui/status-chip";

/**
 * Mentor's view of one of their students. The numbers are scoped to THIS mentor
 * (hours the student holds with them, sessions they ran together), but the
 * meetings log and the assignment plan are the student's whole picture: a
 * mentor picking up an essay needs to know what the last three meetings covered
 * and who else is working on what. Read-only on the plan, which only admins set.
 *
 * Only reachable for students the mentor has an allocation, a session or a
 * TASK with, or any student in a program they work in: a mentor there may log
 * for them whether or not an admin has granted hours yet (their "Whose hours?"
 * tick decides whether those hours charge), and logging against live unassigned
 * time makes those hours theirs.
 */
export default async function MentorStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const mentor = await requireMentor();
  const viewer = { audience: "mentor" as const, userId: mentor.id, now: new Date() };
  const { id } = await params;

  const profile = await prisma.studentProfile.findUnique({
    where: { id },
    include: { user: true, program: true, cohort: true },
  });
  if (!profile) notFound();

  const [allocation, poolRow, scope, ledger, hours, meetings] =
    await Promise.all([
    prisma.hourAllocation.findUnique({
      where: {
        studentId_mentorId: { studentId: profile.id, mentorId: mentor.id },
      },
    }),
    prisma.hourAllocation.findFirst({
      where: { studentId: profile.id, mentorId: null },
    }),
    // Working in the student's program (and cohort, where the assignment is
    // cohort-scoped) is what opens this page to a mentor who holds nothing for
    // them yet — the same rule logSession enforces, so every student the form
    // will accept is a student this page will show. Without it, one live pool
    // would show any mentor anywhere this student's whole ledger.
    prisma.mentorAssignment.findFirst({
      where: {
        mentorId: mentor.id,
        programId: profile.programId,
        OR: [
          { cohortId: null },
          ...(profile.cohortId ? [{ cohortId: profile.cohortId }] : []),
        ],
      },
    }),
    studentLedger(profile.id),
    allocationSummary(profile.id),
    studentMeetings(profile.id),
  ]);

  const mySessions = ledger.sessions.filter((s) => s.mentorId === mentor.id);
  const tasksBySession = await taskOptionsForSessions(ledger.sessions);

  // The pool matters here only while it's live, and only until the mentor has
  // hours of their own — their sessions then draw those, not the pool.
  const pool =
    !allocation &&
    scope &&
    poolRow &&
    poolRow.minutes > 0 &&
    !deadlinePassed(poolRow.deadline)
      ? poolRow
      : null;

  // A task of theirs here is entitlement too, and the last one checked because
  // it is the rarest: an admin can move a task to a mentor who holds no hours
  // for this student and was never in their program, and the caseload row that
  // move creates must not lead to a 404 for the person whose work it is.
  const myTask =
    !allocation && mySessions.length === 0 && !scope
      ? await prisma.assignment.findFirst({
          where: { studentId: profile.id, mentorId: mentor.id },
          select: { id: true },
        })
      : null;

  // Not this mentor's student — no hours together, no history together, no work
  // of theirs, and no program in common that would let them log any.
  if (!allocation && mySessions.length === 0 && !scope && !myTask) notFound();

  const allocated = allocation?.minutes ?? 0;
  const myActive = mySessions.filter((s) => s.status === SESSION_STATUS.ACTIVE);
  // Only charging sessions move this balance; hours given out of plan are
  // counted beside it, never inside it.
  const used = myActive
    .filter(chargesAllocation)
    .reduce((sum, s) => sum + s.minutes, 0);
  const missed = myActive
    .filter((s) => chargesAllocation(s) && !s.attended)
    .reduce((sum, s) => sum + s.minutes, 0);
  const extra = myActive
    .filter((s) => !s.withinPlan)
    .reduce((sum, s) => sum + s.minutes, 0);
  const completed = used - missed;
  // Once the deadline passes, unused hours are forfeited and no more sessions
  // can be logged against the allocation.
  const expired = allocation ? deadlinePassed(allocation.deadline) : false;
  const remaining = expired ? Math.min(0, allocated - used) : allocated - used;
  const approved = profile.user.status === USER_STATUS.ACTIVE;

  return (
    <div className="space-y-8">
      <PageTitle
        backHref="/mentor"
        backLabel="My students"
        eyebrow={`Your student · ${profile.program.name}`}
        // Admins who also mentor came here to look at their student, and half
        // of what they may want to DO about them — grant hours, edit the plan,
        // correct the record — only exists in the admin view of this same
        // student. One link, rather than switching profile and finding them
        // again. Admins may open every student, so it always opens.
        actions={
          mentor.role === ROLES.ADMIN ? (
            <span data-profile-counterpart="true">
              <ArrowLink href={`/admin/students/${profile.id}`}>
                Open in admin view
              </ArrowLink>
            </span>
          ) : undefined
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {profile.user.name ?? profile.user.email}
            {!approved && (
              <StatusChip severity="attention">Pending approval</StatusChip>
            )}
          </span>
        }
        subtitle={
          <>
            {profile.user.email}
            {profile.cohort ? ` · ${profile.cohort.name}` : ""}
            {profile.telegramUsername ? (
              <>
                {" · "}
                <ExternalLink
                  variant="inline"
                  href={`https://t.me/${profile.telegramUsername}`} icon={<SendIcon className="h-3.5 w-3.5" />} title={`Open @${profile.telegramUsername} on Telegram`} className="align-middle">
@{profile.telegramUsername}
</ExternalLink>
              </>
            ) : (
              " · Telegram not set yet"
            )}
            {profile.folderUrl && (
              <>
                {" · "}
                <ExternalLink
                  variant="inline"
                  href={profile.folderUrl} icon={<FolderIcon className="h-3.5 w-3.5" />} title="Open the student's folder" className="align-middle">
Folder
</ExternalLink>
              </>
            )}
            {allocation?.deadline && (
              <>
                <br />
                Your time with them run to{" "}
                <DeadlineText deadline={allocation.deadline} now={viewer.now} />
              </>
            )}
          </>
        }
      />

      <FigureRow>
        <Figure label="Allocated to you" value={formatDuration(allocated)} />
        <Figure
          label="Completed with you"
          value={formatDuration(completed)}
        />
        {missed > 0 && (
          <Figure label="Missed (no-show)" value={formatDuration(missed)} />
        )}
        {extra > 0 && (
          <Figure
            label="Extra, beyond plan"
            value={formatDuration(extra)}
            tone="muted"
          />
        )}
        <Figure
          label="Remaining with you"
          value={formatDuration(remaining)}
          tone={remaining < 0 ? "danger" : "ink"}
          size="lead"
        />
        <Figure
          label="Sessions together"
          value={String(myActive.length)}
          tone="muted"
        />
      </FigureRow>

      {/* Their whole allotment, not just this mentor's slice: a consultant
          picking up an essay needs to know how much room the student has left
          across everyone before booking three more hours of it. */}
      <HoursBreakdown
        allotted={hours.allotted}
        completed={hours.completed}
        missed={hours.missed}
        forfeited={hours.forfeited}
        remaining={hours.remaining}
        extra={hours.extra}
      />

      <ScheduledMeetings
        meetings={meetings}
        viewer={viewer}
        emptyBody="Book an interview and the student is asked to confirm they'll be there."
        toolbar={
          approved ? (
            <ScheduleInterviewForm
              studentProfileId={profile.id}
              studentName={profile.user.name?.split(" ")[0] ?? "The student"}
            />
          ) : (
            <p className="text-sm text-muted-fg">
              Meetings can be scheduled once this student is approved.
            </p>
          )
        }
      />

      <MeetingsLog
        sessions={ledger.sessions}
        manage={{ actorId: mentor.id, tasksBySession }}
      />

      <AssignmentsPanel
        assignments={ledger.assignments}
        studentProfileId={profile.id}
        minutesAllotted={hours.allotted}
      />

      {!approved ? (
        <Callout tone="warn" title="Waiting on admin approval">
          Sessions can be logged for this student once they&apos;re approved.
        </Callout>
      ) : expired ? (
        <Callout tone="danger" title="This time has expired">
          Your time with them ran out on{" "}
          {allocation ? formatDate(allocation.deadline) : ""} and can no longer
          be logged against. Ask an admin to extend the deadline or allocate new
          hours.
        </Callout>
      ) : (
        <>
          {pool ? (
            <Callout tone="info" title="Unassigned time available">
              This student holds {formatDuration(pool.minutes)} no mentor
              was named for, usable until {formatDate(pool.deadline)}. Log a
              session below and the hours you log become yours.
            </Callout>
          ) : (
            /* Every figure above reads zero, which on its own looks like a
               student the mentor shouldn't be seeing. Say what they CAN do
               instead: the meeting is loggable either way, and the tick is
               what decides whether it needs hours nobody has granted yet. */
            !allocation && (
              <Callout tone="info" title="No time allocated to you yet">
                You work in {profile.program.name}, so you can log meetings
                with {profile.user.name?.split(" ")[0] ?? "them"} now. In-plan
                hours will show as an overdraw until an admin allocates them —
                or pick &ldquo;Extra, beyond their time&rdquo; for time given on
                top of the plan, which charges nothing.
              </Callout>
            )
          )}
          <LogSessionForm
            students={[
              {
                profileId: profile.id,
                label: profile.user.name ?? profile.user.email,
                hint: pool
                  ? `${formatDuration(pool.minutes)} unassigned — logging makes them yours`
                  : allocation
                    ? `${formatDuration(remaining)} left with you`
                    : `No time allocated to you — in-plan hours will overdraw`,
                goals: ledger.assignments
                  .filter(
                    (a) => a.mentorId === mentor.id || a.mentorId === null
                  )
                  .map((a) => ({
                    value: a.id,
                    label:
                      a.progress === ASSIGNMENT_PROGRESS.DONE
                        ? `${a.purpose} (done)`
                        : a.mentorId === null
                          ? `${a.purpose} (unassigned)`
                          : a.purpose,
                  })),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
