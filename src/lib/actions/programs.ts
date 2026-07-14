"use server";

import { revalidatePath } from "next/cache";

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
