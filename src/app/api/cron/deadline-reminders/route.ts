import type { NextRequest } from "next/server";

import { ensureDeadlineReminders } from "@/lib/deadline-reminders";

export const dynamic = "force-dynamic";

/**
 * Scheduled entry point for deadline reminders, hit daily by the Render cron
 * job (see render.yaml). Guarded by CRON_SECRET since it's a public URL —
 * the job sends it as a bearer token.
 *
 * This is the ONLY caller. The dashboards used to run it too, which made
 * every page load pay for a scan of every allocation in the school.
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

  const result = await ensureDeadlineReminders();
  return Response.json({ ok: true, ...result });
}
