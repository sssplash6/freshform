"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ROLES, USER_STATUS } from "@/lib/constants";
import type { ActionState } from "@/lib/actions/shared";

/**
 * Assign a mentor to a cohort with their Calendly link for that cohort
 * (spec §8: links live on the pairing). Re-assigning updates the link.
 * A first assignment activates an UNASSIGNED mentor.
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
  const cohortId = String(formData.get("cohortId") ?? "");
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

  const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
  if (!mentor || mentor.role !== ROLES.MENTOR) {
    return { ok: false, error: "Pick a mentor." };
  }
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    include: { program: true },
  });
  if (!cohort) return { ok: false, error: "Pick a cohort." };

  await prisma.$transaction(async (tx) => {
    await tx.mentorAssignment.upsert({
      where: { mentorId_cohortId: { mentorId, cohortId } },
      update: { calendlyUrl },
      create: { mentorId, cohortId, calendlyUrl },
    });
    if (mentor.status === USER_STATUS.UNASSIGNED) {
      await tx.user.update({
        where: { id: mentorId },
        data: { status: USER_STATUS.ACTIVE },
      });
    }
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${mentor.name ?? mentor.email} assigned to ${cohort.program.name} / ${cohort.name}.`,
  };
}

/** Remove a mentor-cohort assignment (admin correction). */
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
