import { notFound } from "next/navigation";

import { AssignmentsPanel } from "@/components/assignments-panel";
import { Chip } from "@/components/chip";
import { Deadline } from "@/components/deadline";
import { LogSessionForm } from "@/components/forms/log-session-form";
import { ScheduleInterviewForm } from "@/components/forms/schedule-interview-form";
import { HoursBreakdown } from "@/components/hours-breakdown";
import { MeetingsLog } from "@/components/meetings-log";
import { ScheduledMeetings } from "@/components/scheduled-meetings";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StudentFolderLink } from "@/components/student-folder-link";
import { TelegramHandle } from "@/components/telegram-handle";
import { Callout } from "@/components/ui/callout";
import { PageHeader } from "@/components/ui/page-header";
import {
  ASSIGNMENT_PROGRESS,
  chargesAllocation,
  SESSION_STATUS,
  USER_STATUS,
} from "@/lib/constants";
import { requireMentor } from "@/lib/dal";
import { deadlinePassed } from "@/lib/deadlines";
import { formatDate, formatHours } from "@/lib/format";
import { allocationSummary } from "@/lib/hours";
import { initials } from "@/lib/person-tone";
import { prisma } from "@/lib/prisma";
import {
  studentLedger,
  studentMeetings,
  taskOptionsForSessions,
} from "@/lib/queries";

/**
 * Mentor's view of one of their students. The numbers are scoped to THIS mentor
 * (hours the student holds with them, sessions they ran together), but the
 * meetings log and the assignment plan are the student's whole picture: a
 * mentor picking up an essay needs to know what the last three meetings covered
 * and who else is working on what. Read-only on the plan, which only admins set.
 *
 * Only reachable for students the mentor has an allocation or a session with —
 * or ones holding live unassigned hours, which any mentor may log against
 * (the logged hours become theirs).
 */
export default async function MentorStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const mentor = await requireMentor();
  const { id } = await params;

  const profile = await prisma.studentProfile.findUnique({
    where: { id },
    include: { user: true, program: true, cohort: true },
  });
  if (!profile) notFound();

  const [allocation, poolRow, poolScope, ledger, hours, meetings] =
    await Promise.all([
    prisma.hourAllocation.findUnique({
      where: {
        studentId_mentorId: { studentId: profile.id, mentorId: mentor.id },
      },
    }),
    prisma.hourAllocation.findFirst({
      where: { studentId: profile.id, mentorId: null },
    }),
    // The pool only opens this page to mentors actually working in the
    // student's program (and cohort, where the assignment is cohort-scoped) —
    // the same rule logSession enforces. Without it, a live pool would show
    // any mentor anywhere this student's whole ledger.
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
    poolScope &&
    poolRow &&
    poolRow.hours > 0 &&
    !deadlinePassed(poolRow.deadline)
      ? poolRow
      : null;

  // Not this mentor's student — no hours together, no history together, and no
  // unassigned hours a session could claim.
  if (!allocation && mySessions.length === 0 && !pool) notFound();

  const allocated = allocation?.hours ?? 0;
  const myActive = mySessions.filter((s) => s.status === SESSION_STATUS.ACTIVE);
  // Only charging sessions move this balance; hours given out of plan are
  // counted beside it, never inside it.
  const used = myActive
    .filter(chargesAllocation)
    .reduce((sum, s) => sum + s.hours, 0);
  const missed = myActive
    .filter((s) => chargesAllocation(s) && !s.attended)
    .reduce((sum, s) => sum + s.hours, 0);
  const extra = myActive
    .filter((s) => !s.withinPlan)
    .reduce((sum, s) => sum + s.hours, 0);
  const completed = used - missed;
  // Once the deadline passes, unused hours are forfeited and no more sessions
  // can be logged against the allocation.
  const expired = allocation ? deadlinePassed(allocation.deadline) : false;
  const remaining = expired ? Math.min(0, allocated - used) : allocated - used;
  const approved = profile.user.status === USER_STATUS.ACTIVE;

  return (
    <div className="space-y-8">
      <PageHeader
        backHref="/mentor"
        backLabel="My students"
        eyebrow={`Your student · ${profile.program.name}`}
        monogram={initials(profile.user.name, profile.user.email)}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {profile.user.name ?? profile.user.email}
            {!approved && <Chip tone="amber">Pending approval</Chip>}
          </span>
        }
        subtitle={
          <>
            {profile.user.email}
            {profile.cohort ? ` · ${profile.cohort.name}` : ""}
            {profile.telegramUsername ? (
              <>
                {" · "}
                <TelegramHandle
                  username={profile.telegramUsername}
                  className="align-middle"
                />
              </>
            ) : (
              " · Telegram not set yet"
            )}
            {profile.folderUrl && (
              <>
                {" · "}
                <StudentFolderLink
                  url={profile.folderUrl}
                  className="align-middle"
                />
              </>
            )}
            {allocation?.deadline && (
              <>
                <br />
                Your hours with them run to{" "}
                <Deadline deadline={allocation.deadline} />
              </>
            )}
          </>
        }
      />

      <StatCardGrid>
        <StatCard label="Allocated to you" value={formatHours(allocated)} />
        <StatCard
          label="Completed with you"
          value={formatHours(completed)}
          tone="brand"
        />
        {missed > 0 && (
          <StatCard label="Missed (no-show)" value={formatHours(missed)} />
        )}
        {extra > 0 && (
          <StatCard
            label="Extra, beyond plan"
            value={formatHours(extra)}
            tone="muted"
          />
        )}
        <StatCard
          label="Remaining with you"
          value={formatHours(remaining)}
          suffix="h"
          tone={remaining < 0 ? "danger" : "default"}
          lead
        />
        <StatCard
          label="Sessions together"
          value={String(myActive.length)}
          tone="muted"
        />
      </StatCardGrid>

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
        view="mentor"
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
        hoursAllotted={hours.allotted}
      />

      {!approved ? (
        <Callout tone="warning" title="Waiting on admin approval">
          Sessions can be logged for this student once they&apos;re approved.
        </Callout>
      ) : expired ? (
        <Callout tone="danger" title="These hours have expired">
          Your hours with them ran out on{" "}
          {allocation ? formatDate(allocation.deadline) : ""} and can no longer
          be logged against. Ask an admin to extend the deadline or allocate new
          hours.
        </Callout>
      ) : (
        <>
          {pool && (
            <Callout tone="brand" title="Unassigned hours available">
              This student holds {formatHours(pool.hours)} hours no mentor
              was named for, usable until {formatDate(pool.deadline)}. Log a
              session below and the hours you log become yours.
            </Callout>
          )}
          <LogSessionForm
            students={[
              {
                profileId: profile.id,
                label: profile.user.name ?? profile.user.email,
                hint: pool
                  ? `${formatHours(pool.hours)}h unassigned — logging makes them yours`
                  : `${formatHours(remaining)}h left with you`,
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
