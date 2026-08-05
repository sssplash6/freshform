import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * RFC 8058 one-click unsubscribe. Every digest carries
 * `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, and Gmail and friends
 * POST here when someone uses their built-in unsubscribe button — no page, no
 * confirmation, which is the point of the standard.
 *
 * POST only. The confirm-then-act page at /unsubscribe covers the human path;
 * a GET that unsubscribed could be triggered by any link prefetcher.
 *
 * Note this route is matched by the proxy, which lets it through because it
 * carries no session to check — authorization is the signed token.
 */
export async function POST(request: NextRequest) {
  // The standard sends the token in the URL; be forgiving about a form body too,
  // since some clients echo the List-Unsubscribe-Post parameter as one.
  const params = request.nextUrl.searchParams;
  let userId = params.get("u") ?? "";
  let token = params.get("t") ?? "";

  if (!userId || !token) {
    const body = await request.formData().catch(() => null);
    userId = userId || String(body?.get("u") ?? "");
    token = token || String(body?.get("t") ?? "");
  }

  if (!verifyUnsubscribeToken(userId, token)) {
    return new Response("Invalid unsubscribe token.", { status: 400 });
  }

  await prisma.user.updateMany({
    where: { id: userId },
    data: { weeklyDigest: false },
  });

  // Mail clients only look at the status code.
  return new Response("Unsubscribed.", { status: 200 });
}
