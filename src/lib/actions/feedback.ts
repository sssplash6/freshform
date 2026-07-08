"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/constants";
import type { ActionState } from "@/lib/actions/shared";

function parseRating(raw: FormDataEntryValue | null): number | null {
  const n = Number.parseInt(String(raw ?? ""), 10);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

async function requireStudentProfile() {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.STUDENT) return null;
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
  });
  return profile;
}

/**
 * Student rates a mentor (1–5 + optional comment). The mentor must be
 * relevant to the student: currently assigned to their cohort, or someone
 * they've had a session with. Mentor-facing display is anonymous; the
 * student link is stored for admin/leader views.
 */
export async function submitMentorFeedback(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireStudentProfile();
  if (!profile) {
    return { ok: false, error: "Only students can leave mentor feedback." };
  }

  const rating = parseRating(formData.get("rating"));
  if (!rating) return { ok: false, error: "Pick a rating from 1 to 5." };
  const comment = String(formData.get("comment") ?? "").trim() || null;

  const mentorId = String(formData.get("mentorId") ?? "");
  const [assignment, pastSession] = await Promise.all([
    prisma.mentorAssignment.findUnique({
      where: { mentorId_cohortId: { mentorId, cohortId: profile.cohortId } },
    }),
    prisma.session.findFirst({
      where: { mentorId, studentId: profile.id },
    }),
  ]);
  if (!assignment && !pastSession) {
    return { ok: false, error: "Pick one of your mentors." };
  }

  await prisma.mentorFeedback.create({
    data: { studentId: profile.id, mentorId, rating, comment },
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Thanks! Your mentor feedback was recorded." };
}

/** Student rates the website (1–5 + optional comment). */
export async function submitWebsiteFeedback(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireStudentProfile();
  if (!profile) {
    return { ok: false, error: "Only students can leave website feedback." };
  }

  const rating = parseRating(formData.get("rating"));
  if (!rating) return { ok: false, error: "Pick a rating from 1 to 5." };
  const comment = String(formData.get("comment") ?? "").trim() || null;

  await prisma.websiteFeedback.create({
    data: { studentId: profile.id, rating, comment },
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Thanks! Your website feedback was recorded." };
}
