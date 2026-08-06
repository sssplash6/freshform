"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/constants";
import type { ActionState } from "@/lib/actions/shared";

/**
 * Admin opens a new program. Programs created here live alongside the seeded
 * ones (the seed only upserts by name, it never deletes). Students and
 * mentors attach to the program directly until it's given cohorts.
 */
export async function createProgram(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can create programs." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 3) {
    return { ok: false, error: "Give the program a name (3+ characters)." };
  }

  const existing = await prisma.program.findUnique({ where: { name } });
  if (existing) {
    return { ok: false, error: `A program called ${name} already exists.` };
  }

  await prisma.program.create({ data: { name } });

  revalidatePath("/", "layout");
  return { ok: true, message: `${name} is up and running.` };
}

/**
 * Rename a program. The name is the program's identity everywhere — its own
 * page, every student row, the Master's billing rule in config/app-config.ts —
 * so renaming is deliberately a settings action rather than an inline edit.
 */
export async function renameProgram(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can rename programs." };
  }

  const programId = String(formData.get("programId") ?? "");
  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program) return { ok: false, error: "Program not found." };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 3) {
    return { ok: false, error: "Give the program a name (3+ characters)." };
  }
  if (name === program.name) {
    return { ok: true, message: "No change: that's already its name." };
  }

  const taken = await prisma.program.findUnique({ where: { name } });
  if (taken) {
    return { ok: false, error: `A program called ${name} already exists.` };
  }

  await prisma.program.update({ where: { id: programId }, data: { name } });

  revalidatePath("/", "layout");
  return { ok: true, message: `${program.name} is now called ${name}.` };
}

/**
 * Delete a cohort, once nothing is in it. Students and mentor pairings are
 * moved, not orphaned: an admin re-enrolls them (student page → Corrections)
 * before the cohort can go.
 */
export async function deleteCohort(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can delete cohorts." };
  }

  const cohortId = String(formData.get("cohortId") ?? "");
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    include: {
      _count: { select: { students: true, mentorAssignments: true } },
    },
  });
  if (!cohort) return { ok: false, error: "Cohort not found." };

  if (cohort._count.students > 0) {
    return {
      ok: false,
      error: `${cohort.name} still has ${cohort._count.students} student${cohort._count.students === 1 ? "" : "s"}. Move them to another cohort first.`,
    };
  }
  if (cohort._count.mentorAssignments > 0) {
    return {
      ok: false,
      error: `${cohort.name} still has mentors assigned to it. Unassign them first.`,
    };
  }

  await prisma.cohort.delete({ where: { id: cohortId } });

  revalidatePath("/", "layout");
  return { ok: true, message: `${cohort.name} deleted.` };
}

/**
 * Delete a whole program, once it is empty. Anything with history in it —
 * students, staff scoped to it — blocks the delete rather than being swept up:
 * a program is closed by emptying it, and only then removed.
 */
export async function deleteProgram(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can delete programs." };
  }

  const programId = String(formData.get("programId") ?? "");
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      cohorts: true,
      _count: { select: { students: true, staff: true, mentorAssignments: true } },
    },
  });
  if (!program) return { ok: false, error: "Program not found." };

  if (program._count.students > 0) {
    return {
      ok: false,
      error: `${program.name} still has ${program._count.students} student${program._count.students === 1 ? "" : "s"}. Remove or move them first.`,
    };
  }
  if (program._count.staff > 0) {
    return {
      ok: false,
      error: `${program.name} is some staff member's scope. Re-scope them in config/app-config.ts and re-seed first.`,
    };
  }

  // Mentor pairings and empty cohorts are part of the program's own setup, so
  // they go with it; nothing was ever logged against them.
  await prisma.$transaction(async (tx) => {
    await tx.mentorAssignment.deleteMany({ where: { programId } });
    await tx.cohort.deleteMany({ where: { programId } });
    await tx.program.delete({ where: { id: programId } });
  });

  revalidatePath("/", "layout");
  redirect("/admin");
}

/**
 * Admin adds a cohort to a program. The first cohort switches the program to
 * cohort-based enrollment for NEW students/assignments; existing program-wide
 * members are unaffected.
 */
export async function createCohort(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== ROLES.ADMIN) {
    return { ok: false, error: "Only admins can create cohorts." };
  }

  const programId = String(formData.get("programId") ?? "");
  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program) return { ok: false, error: "Program not found." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Give the cohort a name." };

  const existing = await prisma.cohort.findUnique({
    where: { programId_name: { programId, name } },
  });
  if (existing) {
    return {
      ok: false,
      error: `${program.name} already has a cohort called ${name}.`,
    };
  }

  await prisma.cohort.create({ data: { programId, name } });

  revalidatePath("/", "layout");
  return { ok: true, message: `${name} added to ${program.name}.` };
}
