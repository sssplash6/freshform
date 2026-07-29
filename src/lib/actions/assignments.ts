"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  ASSIGNMENT_PROGRESS,
  ASSIGNMENT_PROGRESS_LABELS,
  canActAsMentor,
  ROLES,
} from "@/lib/constants";
import { parseHoursField, type ActionState } from "@/lib/actions/shared";

/**
 * The plan half of a student's ledger: which consultant is doing what, with
 * what hour budget, by when, and how far along it is. Only admins write here
 * (mentors and students read it), matching how the tracking spreadsheet was
 * run: the mentor fills the meetings log by logging sessions, the admin
 * assigns the work.
 *
 * An assignment budgets hours, it does not grant them. Granting stays in
 * setMentorAllocation, which is what sessions draw down and deadlines forfeit.
 */

const PROGRESS_VALUES: string[] = Object.values(ASSIGNMENT_PROGRESS);
const MAX_PURPOSE = 200;
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
  const purpose = String(formData.get("purpose") ?? "").trim();
  if (!purpose) return { error: "Say what this assignment is for." };
  if (purpose.length > MAX_PURPOSE) {
    return { error: `Keep the purpose under ${MAX_PURPOSE} characters.` };
  }

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

/** Add a row to a student's plan. */
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

  await prisma.assignment.create({
    data: {
      studentId,
      mentorId,
      ...fields,
      position: (last?.position ?? -1) + 1,
      createdById: actor.id,
    },
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `"${fields.purpose}" assigned to ${mentor.name ?? mentor.email}.`,
  };
}

/** Edit a row: any of purpose, consultant, hour limit, timeline, progress. */
export async function updateAssignment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can change assignments." };
  }

  const id = String(formData.get("assignmentId") ?? "");
  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Assignment not found." };

  const mentorId = String(formData.get("mentorId") ?? "");
  const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
  if (!mentor || !canActAsMentor(mentor)) {
    return { ok: false, error: "Pick a consultant." };
  }

  const fields = parseFields(formData);
  if ("error" in fields) return { ok: false, error: fields.error };

  await prisma.assignment.update({
    where: { id },
    data: { mentorId, ...fields },
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
    return { ok: false, error: "Only admins can change assignments." };
  }

  const id = String(formData.get("assignmentId") ?? "");
  const progress = String(formData.get("progress") ?? "");
  if (!PROGRESS_VALUES.includes(progress)) {
    return { ok: false, error: "Pick a progress state." };
  }

  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Assignment not found." };
  if (existing.progress === progress) {
    return { ok: true, message: "No change." };
  }

  await prisma.assignment.update({ where: { id }, data: { progress } });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `"${existing.purpose}" is now ${ASSIGNMENT_PROGRESS_LABELS[progress].toLowerCase()}.`,
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
    return { ok: false, error: "Only admins can remove assignments." };
  }

  const id = String(formData.get("assignmentId") ?? "");
  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Assignment not found." };

  await prisma.assignment.delete({ where: { id } });

  revalidatePath("/", "layout");
  return { ok: true, message: `"${existing.purpose}" removed from the plan.` };
}
