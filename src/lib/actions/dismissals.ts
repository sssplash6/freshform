"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { STATUS_TYPES } from "@/lib/status";

/**
 * Silence one attention row, for this reader, for good.
 *
 * Attention rows are derived — there is nothing on them to mark as read — and
 * most clear themselves the moment the thing they describe is dealt with. The
 * few that cannot are the problem: a mentor nobody intends to place, a student
 * imported without an address who will never sign in. Those sit on the inbox
 * forever, and a list that always carries the same row stops being read at all.
 *
 * Per reader, never global. One admin having seen enough of a row must not
 * hide it from the person who was going to act on it.
 */
export async function dismissStatus(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const type = String(formData.get("type") ?? "");
  // The type has to be one the status model actually produces: this is written
  // from a form, and an unknown string would sit in the table forever matching
  // nothing, which is a silent leak rather than an error anybody sees.
  if (!(STATUS_TYPES as readonly string[]).includes(type)) return;

  const subjectId = String(formData.get("subjectId") ?? "");

  await prisma.statusDismissal.upsert({
    where: { userId_type_subjectId: { userId: user.id, type, subjectId } },
    update: {},
    create: { userId: user.id, type, subjectId },
  });

  revalidatePath("/", "layout");
}

/** Put one back. The row returns if the thing it describes is still true. */
export async function restoreStatus(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.statusDismissal.deleteMany({
    where: {
      userId: user.id,
      type: String(formData.get("type") ?? ""),
      subjectId: String(formData.get("subjectId") ?? ""),
    },
  });

  revalidatePath("/", "layout");
}
