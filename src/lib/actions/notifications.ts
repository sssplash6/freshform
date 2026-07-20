"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/** Mark all of the current user's notifications as read. */
export async function markAllNotificationsRead(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });

  revalidatePath("/", "layout");
}

/** Mark one of the current user's notifications as read. */
export async function markNotificationRead(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const id = String(formData.get("notificationId") ?? "");
  if (!id) return;

  await prisma.notification.updateMany({
    where: { id, userId: user.id, read: false },
    data: { read: true },
  });

  revalidatePath("/", "layout");
}
