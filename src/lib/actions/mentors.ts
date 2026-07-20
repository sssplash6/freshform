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

/** Resolve every checked "p:"/"c:" target; null if any fails to resolve. */
async function resolveAssignmentTargets(raw: FormDataEntryValue[]) {
  const targets = await Promise.all(
    raw.map((value) => resolveAssignmentTarget(String(value)))
  );
  if (targets.some((t) => !t)) return null;
  // Deduplicate identical targets (same program + cohort pairing).
  const seen = new Set<string>();
  return (targets as NonNullable<(typeof targets)[number]>[]).filter((t) => {
    const key = `${t.programId}:${t.cohortId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Admin registers a mentor directly (the mentor pool is small): email, full
 * name, and every program — or cohort, where the program has them — they
 * work in. The mentor then signs in with Google and sets their own booking
 * links.
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

  const targets = await resolveAssignmentTargets(formData.getAll("targets"));
  if (!targets || targets.length === 0) {
    return { ok: false, error: "Pick at least one program or cohort." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: `${email} already has an account.` };
  }

  const labels = targets.map((t) => t.label).join(", ");
  await prisma.$transaction(async (tx) => {
    const mentor = await tx.user.create({
      data: {
        email,
        name,
        role: ROLES.MENTOR,
        status: USER_STATUS.ACTIVE,
      },
    });
    await tx.mentorAssignment.createMany({
      data: targets.map((t) => ({
        mentorId: mentor.id,
        programId: t.programId,
        cohortId: t.cohortId,
      })),
    });
    // Greets them on first sign-in.
    await tx.notification.create({
      data: {
        userId: mentor.id,
        type: NOTIFICATION_TYPES.MENTOR_ASSIGNED,
        message: `You were registered as a mentor in ${labels}. Set your booking link on your mentor page so students there can book you.`,
      },
    });
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Mentor ${name} (${email}) registered in ${labels}. They can sign in with Google right away and set their booking links.`,
  };
}

/**
 * Admin edits a mentor: name, sign-in email, and the full set of
 * program/cohort assignments (checked = assigned). The booking links on
 * pairings that survive the edit are kept; the mentor sets those themselves
 * (spec §8). Unchecking every target parks the mentor as UNASSIGNED again;
 * a first assignment activates them.
 */
export async function updateMentor(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can edit mentors." };
  }

  const mentorId = String(formData.get("mentorId") ?? "");
  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
    include: { mentorAssignments: true },
  });
  if (!mentor || mentor.role !== ROLES.MENTOR) {
    return { ok: false, error: "Mentor not found." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Enter the mentor's full name." };
  const email = normalizeEmail(formData.get("email"));
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const emailTaken = await prisma.user.findUnique({ where: { email } });
  if (emailTaken && emailTaken.id !== mentorId) {
    return { ok: false, error: `${email} already has an account.` };
  }

  const targets = await resolveAssignmentTargets(formData.getAll("targets"));
  if (!targets) return { ok: false, error: "Pick a program or cohort." };

  const wanted = new Set(targets.map((t) => `${t.programId}:${t.cohortId ?? ""}`));
  const toCreate = targets.filter(
    (t) =>
      !mentor.mentorAssignments.some(
        (a) => a.programId === t.programId && a.cohortId === t.cohortId
      )
  );
  const toDelete = mentor.mentorAssignments.filter(
    (a) => !wanted.has(`${a.programId}:${a.cohortId ?? ""}`)
  );
  const remaining =
    mentor.mentorAssignments.length - toDelete.length + toCreate.length;

  const detailsChanged = name !== mentor.name || email !== mentor.email;
  if (!detailsChanged && toCreate.length === 0 && toDelete.length === 0) {
    return { ok: true, message: "No changes to save." };
  }

  await prisma.$transaction(async (tx) => {
    if (detailsChanged) {
      await tx.user.update({ where: { id: mentorId }, data: { name, email } });
    }
    if (toDelete.length > 0) {
      await tx.mentorAssignment.deleteMany({
        where: { id: { in: toDelete.map((a) => a.id) } },
      });
    }
    if (toCreate.length > 0) {
      await tx.mentorAssignment.createMany({
        data: toCreate.map((t) => ({
          mentorId,
          programId: t.programId,
          cohortId: t.cohortId,
        })),
      });
      await tx.notification.create({
        data: {
          userId: mentorId,
          type: NOTIFICATION_TYPES.MENTOR_ASSIGNED,
          message: `You were assigned to ${toCreate.map((t) => t.label).join(", ")}. Set your booking link on your mentor page so students there can book you.`,
        },
      });
    }
    if (remaining === 0 && mentor.status === USER_STATUS.ACTIVE) {
      await tx.user.update({
        where: { id: mentorId },
        data: { status: USER_STATUS.UNASSIGNED },
      });
    } else if (remaining > 0 && mentor.status === USER_STATUS.UNASSIGNED) {
      await tx.user.update({
        where: { id: mentorId },
        data: { status: USER_STATUS.ACTIVE },
      });
    }
  });

  revalidatePath("/", "layout");
  return { ok: true, message: `${name} updated.` };
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
