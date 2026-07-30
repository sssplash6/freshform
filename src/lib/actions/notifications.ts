"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * Open a notification: mark it read, then go where it points. The whole row is
 * this form's button, so reading and acting are one gesture instead of a
 * "mark read" chore next to a separate link.
 *
 * Only relative in-app paths are followed. The column is written by our own
 * producers, but a redirect target is exactly the field you do not want to
 * trust blindly.
 */
export async function openNotification(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = String(formData.get("notificationId") ?? "");
  const notification = id
    ? await prisma.notification.findUnique({ where: { id } })
    : null;

  if (notification && notification.userId === user.id) {
    if (!notification.read) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { read: true },
      });
    }
    revalidatePath("/", "layout");
    const href = notification.href;
    if (href && href.startsWith("/") && !href.startsWith("//")) {
      redirect(href);
    }
  }

  redirect("/notifications");
}

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
