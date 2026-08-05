"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

/**
 * Who may switch the weekly email off, and how.
 *
 * Two doors on purpose. Signed-in people use the toggle on /notifications. The
 * link in the email footer has to work for someone who is not signed in and
 * never will be — a student who wants the mail to stop should not have to find
 * their password to say so — so that path authorizes on the signed token in the
 * URL instead of a session.
 */

/** The in-app toggle. Authorized by session; only ever affects the actor. */
export async function setWeeklyDigest(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  // The checkbox is absent from the payload when unchecked.
  const on = formData.get("weeklyDigest") === "on";
  if (on !== user.weeklyDigest) {
    await prisma.user.update({
      where: { id: user.id },
      data: { weeklyDigest: on },
    });
  }

  revalidatePath("/notifications");
}

/**
 * The email footer link. Authorized by the HMAC in the URL, so it works from an
 * inbox with no session. Idempotent — unsubscribing twice is a no-op, which
 * matters because mail clients retry.
 *
 * A plain form action that redirects, rather than the useActionState pattern
 * used elsewhere: this page is opened from an email client, sometimes with
 * scripting off, and an unsubscribe button that needs React to have hydrated is
 * an unsubscribe button that sometimes does nothing.
 */
export async function unsubscribeWeekly(formData: FormData): Promise<void> {
  const userId = String(formData.get("u") ?? "");
  const token = String(formData.get("t") ?? "");
  if (!verifyUnsubscribeToken(userId, token)) {
    redirect("/unsubscribe?state=invalid");
  }

  // updateMany, not update: a deleted account should not throw here.
  await prisma.user.updateMany({
    where: { id: userId },
    data: { weeklyDigest: false },
  });

  redirect("/unsubscribe?state=done");
}
