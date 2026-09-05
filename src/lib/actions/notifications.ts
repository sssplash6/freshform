"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function markAllNotificationsRead(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    // The instant, not just the fact: "read" answers the badge, "when" is what
    // lets a feed say which of these are new since somebody last looked.
    data: { read: true, readAt: new Date() },
  });

  revalidatePath("/", "layout");
}
