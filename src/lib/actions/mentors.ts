"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { NOTIFICATION_TYPES, ROLES, USER_STATUS } from "@/lib/constants";
import {
  EMAIL_RE,
  normalizeEmail,
  type ActionState,
} from "@/lib/actions/shared";

/**
 * Self-signup step 2 for mentors: capture the full name Google didn't supply,
 * so mentors are labeled by name rather than email everywhere they appear.
 */
export async function completeMentorProfile(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.MENTOR) {
    return { ok: false, error: "Only mentors can complete this step." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Enter your full name." };

  await prisma.user.update({ where: { id: actor.id }, data: { name } });

  revalidatePath("/", "layout");
  redirect("/mentor");
}

/**
 * Resolve a "p:<programId>" / "c:<cohortId>" assignment target to the
 * program + optional cohort it names, with a display label.
 */
async function resolveAssignmentTarget(target: string) {
  const [kind, targetId] = target.split(":");
  if (kind === "c") {
    const cohort = await prisma.cohort.findUnique({
      where: { id: targetId },
      include: { program: true },
    });
    if (!cohort) return null;
    return {
      programId: cohort.programId,
      cohortId: cohort.id,
      label: `${cohort.program.name} / ${cohort.name}`,
    };
  }
  if (kind === "p") {
    const program = await prisma.program.findUnique({
      where: { id: targetId },
    });
    if (!program) return null;
    return { programId: program.id, cohortId: null, label: program.name };
  }
  return null;
}

/**
 * Admin registers a mentor directly (the mentor pool is small): email, full
 * name, and the program — or cohort, where the program has them — they work
 * in. The mentor then signs in with Google and sets their own booking link.
 */
export async function createMentor(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can register mentors." };
  }

  const email = normalizeEmail(formData.get("email"));
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Enter the mentor's full name." };

  const target = await resolveAssignmentTarget(
    String(formData.get("target") ?? "")
  );
  if (!target) return { ok: false, error: "Pick a program or cohort." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: `${email} already has an account.` };
  }

  await prisma.$transaction(async (tx) => {
    const mentor = await tx.user.create({
      data: {
        email,
        name,
        role: ROLES.MENTOR,
        status: USER_STATUS.ACTIVE,
      },
    });
    await tx.mentorAssignment.create({
      data: {
        mentorId: mentor.id,
        programId: target.programId,
        cohortId: target.cohortId,
      },
    });
    // Greets them on first sign-in.
    await tx.notification.create({
      data: {
        userId: mentor.id,
        type: NOTIFICATION_TYPES.MENTOR_ASSIGNED,
        message: `You were registered as a mentor in ${target.label}. Set your booking link on your mentor page so students there can book you.`,
      },
    });
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Mentor ${name} (${email}) registered in ${target.label}. They can sign in with Google right away and set their booking link.`,
  };
}

/**
 * Assign a mentor to a program — or to one cohort within it, for programs
 * that have cohorts. The target comes as "p:<programId>" or "c:<cohortId>".
 * The mentor sets the booking link for the pairing themselves afterwards
 * (spec §8: links live on the pairing). A first assignment activates an
 * UNASSIGNED mentor.
 */
export async function assignMentor(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can assign mentors." };
  }

  const mentorId = String(formData.get("mentorId") ?? "");
  const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
  if (!mentor || mentor.role !== ROLES.MENTOR) {
    return { ok: false, error: "Pick a mentor." };
  }

  const target = await resolveAssignmentTarget(
    String(formData.get("target") ?? "")
  );
  if (!target) return { ok: false, error: "Pick a program or cohort." };
  const { programId, cohortId, label } = target;

  // Not an upsert: SQLite unique indexes treat NULL cohortIds as distinct,
  // so program-wide pairings are deduplicated here instead.
  const existing = await prisma.mentorAssignment.findFirst({
    where: { mentorId, programId, cohortId },
  });
  if (existing) {
    return {
      ok: true,
      message: `${mentor.name ?? mentor.email} is already assigned to ${label}.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.mentorAssignment.create({
      data: { mentorId, programId, cohortId },
    });
    if (mentor.status === USER_STATUS.UNASSIGNED) {
      await tx.user.update({
        where: { id: mentorId },
        data: { status: USER_STATUS.ACTIVE },
      });
    }
    await tx.notification.create({
      data: {
        userId: mentorId,
        type: NOTIFICATION_TYPES.MENTOR_ASSIGNED,
        message: `You were assigned to ${label}. Set your booking link on your mentor page so students there can book you.`,
      },
    });
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${mentor.name ?? mentor.email} assigned to ${label}. They set their booking link from their mentor page.`,
  };
}

/**
 * A mentor sets or updates the booking link on ONE of their own assignments
 * (links are per pairing; admins create the pairing but never set the link).
 */
export async function setBookingLink(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.MENTOR) {
    return { ok: false, error: "Only mentors can set their booking link." };
  }

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const assignment = await prisma.mentorAssignment.findUnique({
    where: { id: assignmentId },
    include: { program: true, cohort: true },
  });
  if (!assignment || assignment.mentorId !== actor.id) {
    return { ok: false, error: "You can only edit your own booking links." };
  }

  const calendlyUrl = String(formData.get("calendlyUrl") ?? "").trim();
  let url: URL;
  try {
    url = new URL(calendlyUrl);
  } catch {
    return { ok: false, error: "Enter a valid booking URL." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, error: "The booking URL must use https." };
  }

  await prisma.mentorAssignment.update({
    where: { id: assignment.id },
    data: { calendlyUrl },
  });

  revalidatePath("/", "layout");
  const label = assignment.cohort
    ? `${assignment.program.name} / ${assignment.cohort.name}`
    : assignment.program.name;
  return { ok: true, message: `Booking link for ${label} saved.` };
}

/** Remove a mentor-program/cohort assignment (admin correction). */
export async function removeAssignment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can remove assignments." };
  }

  const id = String(formData.get("assignmentId") ?? "");
  const assignment = await prisma.mentorAssignment.findUnique({
    where: { id },
  });
  if (!assignment) return { ok: false, error: "Assignment not found." };

  await prisma.mentorAssignment.delete({ where: { id } });

  revalidatePath("/", "layout");
  return { ok: true, message: "Assignment removed." };
}
