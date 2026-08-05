import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { appUrl } from "@/lib/email/send";

/**
 * Signed opt-out links, so someone can stop a recurring email without signing
 * in. Students are external clients — telling them to log in to stop email is
 * how a digest gets marked as spam instead of unsubscribed.
 *
 * The token is an HMAC of the user id under NEXTAUTH_SECRET: no table, nothing
 * to expire, and unforgeable without the secret. Rotating NEXTAUTH_SECRET
 * invalidates outstanding links, which is the correct trade — old links in old
 * inboxes should not outlive a secret rotation.
 */

function key(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required to sign email links.");
  return secret;
}

export function unsubscribeToken(userId: string): string {
  return createHmac("sha256", key())
    .update(`weekly-digest:${userId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  if (!userId || !token) return false;
  const expected = Buffer.from(unsubscribeToken(userId));
  const given = Buffer.from(token);
  // Length must match before timingSafeEqual, which throws on a mismatch.
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unsubscribeUrl(userId: string): string {
  const params = new URLSearchParams({ u: userId, t: unsubscribeToken(userId) });
  return `${appUrl()}/unsubscribe?${params.toString()}`;
}
