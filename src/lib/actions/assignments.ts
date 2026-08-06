"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  ASSIGNMENT_PROGRESS,
  ASSIGNMENT_PROGRESS_AUTO,
  ASSIGNMENT_PROGRESS_LABELS,
  canActAsMentor,
  NOTIFICATION_TYPES,
  ROLES,
} from "@/lib/constants";
import { formatHours } from "@/lib/format";
import { syncGoalProgress } from "@/lib/goal-progress";
import { notify, notificationHref } from "@/lib/notify";
import { parseTaskField } from "@/lib/tasks";
import { parseHoursField, type ActionState } from "@/lib/actions/shared";

/**
 * The plan half of a student's ledger: which consultant is doing what task, with
 * what hour budget, by when, and how far along it is. Only admins write here
 * (mentors and students read it), matching how the tracking spreadsheet was
 * run: the mentor fills the meetings log by logging sessions, the admin
 * assigns the work.
 *
 * A task budgets hours, it does not grant them. Granting stays in
 * setMentorAllocation — which names a task too, and is the usual way a task is
 * born, since hours and the work they pay for arrive together.
 */

const PROGRESS_VALUES: string[] = Object.values(ASSIGNMENT_PROGRESS);
const MAX_TIMELINE = 60;

/** Every field an assignment row holds, validated together. */
function parseFields(
  formData: FormData
):
  | { error: string }
  | {
      purpose: string;
      hourLimit: number | null;
      timeline: string | null;
      progress: string;
    } {
  // Either a task off the shared list or one typed in its place — the same
  // vocabulary the allocation forms use, so the two ways of creating a task
  // can't drift into two sets of names.
  const task = parseTaskField(
    formData.get("purpose"),
    formData.get("purposeCustom")
  );
  if ("error" in task) return { error: task.error };
  const purpose = task.value;

  // Blank means "not budgeted yet", which is a normal state for a row an admin
  // is still thinking about — only a non-empty value has to be a valid number.
  const rawLimit = String(formData.get("hourLimit") ?? "").trim();
  let hourLimit: number | null = null;
  if (rawLimit) {
    const parsed = parseHoursField(rawLimit, { min: 0, label: "The hour limit" });
    if ("error" in parsed) return { error: parsed.error };
    hourLimit = parsed.value;
  }

  const timeline = String(formData.get("timeline") ?? "").trim();
  if (timeline.length > MAX_TIMELINE) {
    return { error: `Keep the timeline under ${MAX_TIMELINE} characters.` };
  }

  const progress = String(formData.get("progress") ?? ASSIGNMENT_PROGRESS.NOT_STARTED);
  if (!PROGRESS_VALUES.includes(progress)) {
    return { error: "Pick a progress state." };
  }

  return { purpose, hourLimit, timeline: timeline || null, progress };
}

/** Add a task to a student's plan. */
export async function createAssignment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can assign work." };
  }

  const studentId = String(formData.get("studentProfileId") ?? "");
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: { user: true },
  });
  if (!student) return { ok: false, error: "Student not found." };

  const mentorId = String(formData.get("mentorId") ?? "");
  const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
  if (!mentor || !canActAsMentor(mentor)) {
    return { ok: false, error: "Pick a consultant." };
  }

  const fields = parseFields(formData);
  if ("error" in fields) return { ok: false, error: fields.error };

  // Append: one past the current highest position, so a new row lands last
  // even after rows have been deleted from the middle.
  const last = await prisma.assignment.findFirst({
    where: { studentId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const studentName = student.user.name ?? student.user.email;
  const budget =
    fields.hourLimit != null ? ` ${formatHours(fields.hourLimit)} hours` : "";
  const by = fields.timeline ? ` by ${fields.timeline}` : "";

  await prisma.$transaction(async (tx) => {
    await tx.assignment.create({
      data: {
        studentId,
        mentorId,
        ...fields,
        // Progress the admin typed on the form is a starting state, not a pin:
        // hours logged later still move it. Only setAssignmentProgress pins.
        progressManual: false,
        position: (last?.position ?? -1) + 1,
        createdById: actor.id,
      },
    });
    // The whole point of assigning work is that the consultant finds out.
    await notify(tx, {
      to: [mentorId],
      type: NOTIFICATION_TYPES.GOAL_ASSIGNED,
      actorId: actor.id,
      href: notificationHref.mentorStudent(studentId),
      message: `New task for ${studentName}: "${fields.purpose}".${budget ? ` Budgeted${budget}${by}.` : by ? ` Due${by}.` : ""} Log your sessions against it.`,
    });
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `"${fields.purpose}" assigned to ${mentor.name ?? mentor.email}, who has been notified.`,
  };
}

/** Edit a task: any of name, consultant, hour limit, timeline, progress. */
export async function updateAssignment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can change tasks." };
  }

  const id = String(formData.get("assignmentId") ?? "");
  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "That task no longer exists." };

  const mentorId = String(formData.get("mentorId") ?? "");
  const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
  if (!mentor || !canActAsMentor(mentor)) {
    return { ok: false, error: "Pick a consultant." };
  }

  const fields = parseFields(formData);
  if ("error" in fields) return { ok: false, error: fields.error };

  const student = await prisma.studentProfile.findUnique({
    where: { id: existing.studentId },
    include: { user: true },
  });
  const studentName = student
    ? (student.user.name ?? student.user.email)
    : "a student";

  await prisma.$transaction(async (tx) => {
    await tx.assignment.update({
      where: { id },
      data: { mentorId, ...fields },
    });

    // Moving the hour limit can finish a goal outright or reopen it, so the
    // derived progress is recomputed unless an admin has pinned it.
    await syncGoalProgress(tx, id);

    // Both consultants hear about a hand-off; notify() drops the actor, so an
    // admin reassigning to themselves isn't told about their own change.
    await notify(tx, {
      to: [mentorId, existing.mentorId],
      type: NOTIFICATION_TYPES.GOAL_CHANGED,
      actorId: actor.id,
      href: notificationHref.mentorStudent(existing.studentId),
      message:
        mentorId === existing.mentorId
          ? `Your task "${fields.purpose}" for ${studentName} was updated${fields.hourLimit != null ? ` — now ${formatHours(fields.hourLimit)} hours` : ""}${fields.timeline ? `, ${fields.timeline}` : ""}.`
          : `"${fields.purpose}" for ${studentName} was reassigned.`,
    });
  });

  revalidatePath("/", "layout");
  return { ok: true, message: `"${fields.purpose}" updated.` };
}

/**
 * Flip just the progress state, for the one-click control on each row — the
 * edit form is far too much ceremony for marking something done.
 */
export async function setAssignmentProgress(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can change tasks." };
  }

  const id = String(formData.get("assignmentId") ?? "");
  const progress = String(formData.get("progress") ?? "");
  // Not a state, a release: hand the goal back to its hours.
  if (progress !== ASSIGNMENT_PROGRESS_AUTO && !PROGRESS_VALUES.includes(progress)) {
    return { ok: false, error: "Pick a progress state." };
  }

  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "That task no longer exists." };

  if (progress === ASSIGNMENT_PROGRESS_AUTO) {
    if (!existing.progressManual) {
      return { ok: true, message: "This task already follows its hours." };
    }
    const synced = await prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id },
        data: { progressManual: false },
      });
      return syncGoalProgress(tx, id);
    });
    revalidatePath("/", "layout");
    const label = ASSIGNMENT_PROGRESS_LABELS[
      synced?.to ?? existing.progress
    ].toLowerCase();
    return {
      ok: true,
      message: `"${existing.purpose}" follows its logged hours again, and reads as ${label}.`,
    };
  }

  if (existing.progress === progress && existing.progressManual) {
    return { ok: true, message: "No change." };
  }

  await prisma.$transaction(async (tx) => {
    // Stating progress by hand PINS it. Work finished under budget is done even
    // though the hours say otherwise, and later sessions must not reopen it.
    await tx.assignment.update({
      where: { id },
      data: { progress, progressManual: true },
    });
    await notify(tx, {
      to: [existing.mentorId],
      type: NOTIFICATION_TYPES.GOAL_CHANGED,
      actorId: actor.id,
      href: notificationHref.mentorStudent(existing.studentId),
      message: `An admin marked your task "${existing.purpose}" as ${ASSIGNMENT_PROGRESS_LABELS[progress].toLowerCase()}.`,
    });
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `"${existing.purpose}" is now ${ASSIGNMENT_PROGRESS_LABELS[progress].toLowerCase()} and pinned there. Hours logged later won't change it.`,
  };
}

/**
 * Remove a row. Assignments are a plan, not a ledger — nothing draws down from
 * them and no hours are at stake, so a mistake can simply be deleted. The
 * sessions a mentor logged are untouched: they live on the other half.
 */
export async function deleteAssignment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can remove tasks." };
  }

  const id = String(formData.get("assignmentId") ?? "");
  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "That task no longer exists." };

  await prisma.$transaction(async (tx) => {
    await tx.assignment.delete({ where: { id } });
    await notify(tx, {
      to: [existing.mentorId],
      type: NOTIFICATION_TYPES.GOAL_CHANGED,
      actorId: actor.id,
      href: notificationHref.mentorStudent(existing.studentId),
      message: `The task "${existing.purpose}" was removed from the plan. Sessions you already logged against it are kept.`,
    });
  });

  revalidatePath("/", "layout");
  return { ok: true, message: `"${existing.purpose}" removed from the plan.` };
}
