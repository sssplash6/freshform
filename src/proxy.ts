import { NextRequest, NextResponse } from "next/server";

// Optimistic auth check only (cookie presence — no DB, no JWT verification).
// Real enforcement lives in the DAL (src/lib/dal.ts): every page and server
// action verifies the session and role server-side.
const PUBLIC_PATHS = ["/login"];

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSessionCookie =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!hasSessionCookie && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Deliberately NOT the mirror image of the rule above: a PRESENT cookie is
  // not a VALID session. Bouncing /login → / on mere presence locks anyone out
  // whose cookie can no longer be decrypted (a rotated NEXTAUTH_SECRET, a
  // truncated cookie): / verifies for real, finds nobody, and sends them back
  // to /login, which bounces to / again — an unbreakable loop with no way to
  // sign in. Sending signed-in users away from /login is a convenience, so it
  // belongs where the session is actually verified: app/login/page.tsx.
  return NextResponse.next();
}

export const config = {
  // Everything except the auth endpoints, the cron endpoints (which carry
  // their own CRON_SECRET bearer check), Next internals, and static assets.
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
