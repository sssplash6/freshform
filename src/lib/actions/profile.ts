"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { canActAsMentor } from "@/lib/constants";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  sniffImageType,
} from "@/lib/avatar";
import { type ActionState } from "@/lib/actions/shared";

/**
 * A mentor's own profile: their display name and their picture.
 *
 * All three actions are self-service only — the actor is always the subject,
 * never an id from the form — so there is nothing to authorize beyond "are you
 * a mentor". Admins edit mentors through updateMentor in actions/mentors.ts,
 * which is a different job with a different audit story.
 */

/**
 * Rename yourself. This is the same field mentors first fill in at signup
 * (completeMentorProfile), now editable for the rest of the time — people
 * marry, transliterate their name differently, or just typo it on day one.
 */
export async function updateOwnName(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || !canActAsMentor(actor)) {
    return { ok: false, error: "Only mentors can edit their profile." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Enter your full name." };
  if (name.length > 80) {
    return { ok: false, error: "That name is too long (80 characters max)." };
  }
  if (name === actor.name) return { ok: true, message: "No change to save." };

  await prisma.user.update({ where: { id: actor.id }, data: { name } });

  // Their name is on chips in every table across the app.
  revalidatePath("/", "layout");
  return { ok: true, message: "Name saved." };
}

/**
 * Replace your profile picture.
 *
 * Called imperatively rather than through a form action: the browser resizes
 * and re-encodes the chosen file to a small WebP first, so what arrives here is
 * a generated Blob and not the file the person picked.
 *
 * The checks below re-derive everything from the bytes — a resized upload is a
 * convenience, not a guarantee, and this action is reachable directly.
 */
export async function setOwnAvatar(formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || !canActAsMentor(actor)) {
    return { ok: false, error: "Only mentors can set a profile picture." };
  }

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image first." };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return {
      ok: false,
      error: `That image is too large (${Math.round(AVATAR_MAX_BYTES / 1024)}KB max after resizing).`,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Trust the bytes, not the upload's Content-Type: this is what gets served
  // back to browsers later.
  const mimeType = sniffImageType(bytes);
  if (!mimeType || !AVATAR_MIME_TYPES.includes(mimeType as (typeof AVATAR_MIME_TYPES)[number])) {
    return { ok: false, error: "That file isn't a PNG, JPEG, or WebP image." };
  }

  const uploadedAt = new Date();
  await prisma.$transaction([
    prisma.avatarImage.upsert({
      where: { userId: actor.id },
      update: { bytes, mimeType },
      create: { userId: actor.id, bytes, mimeType },
    }),
    // Flips the chips over to the image and busts the cached URL in one write.
    prisma.user.update({
      where: { id: actor.id },
      data: { avatarUpdatedAt: uploadedAt },
    }),
  ]);

  revalidatePath("/", "layout");
  return { ok: true, message: "Picture updated." };
}

/** Drop your picture and go back to the initials badge. */
export async function removeOwnAvatar(): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor || !canActAsMentor(actor)) {
    return { ok: false, error: "Only mentors can change their picture." };
  }
  if (!actor.avatarUpdatedAt) {
    return { ok: true, message: "You don't have a picture set." };
  }

  await prisma.$transaction([
    prisma.avatarImage.deleteMany({ where: { userId: actor.id } }),
    prisma.user.update({
      where: { id: actor.id },
      data: { avatarUpdatedAt: null },
    }),
  ]);

  revalidatePath("/", "layout");
  return { ok: true, message: "Picture removed." };
}
