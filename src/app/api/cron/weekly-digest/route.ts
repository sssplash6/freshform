import type { NextRequest } from "next/server";

import { sendWeeklyDigest } from "@/lib/weekly-digest";

export const dynamic = "force-dynamic";

/**
 * Scheduled entry point for the weekly hours digest, hit every Monday by the
 * Render cron job (see render.yaml). Guarded by CRON_SECRET, like the daily
 * deadline reminders next door.
 *
 * Deliberately NOT mirrored onto page loads the way deadline reminders are: a
 * missed tick here should wait for next Monday, not fire whenever somebody
 * happens to open a dashboard.
 *
 * Three query parameters exist for the first live run and for reading copy
 * changes back, all behind the same secret as the job itself:
 *   ?only=<email>  send to one address and nobody else
 *   ?force=1       ignore the six-day resend guard
 *   ?preview=1     compose and return the mail without sending or stamping
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is not configured on this deployment." },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const result = await sendWeeklyDigest({
    only: params.get("only") ?? undefined,
    force: params.get("force") === "1",
    preview: params.get("preview") === "1",
  });

  // `live: false` means no RESEND_API_KEY/EMAIL_FROM yet, so the run composed
  // and logged instead of sending. Surfaced in the response so a green cron log
  // is never mistaken for delivered mail.
  return Response.json({ ok: true, ...result });
}
