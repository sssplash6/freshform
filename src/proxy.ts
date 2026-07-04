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

  if (hasSessionCookie && isPublic) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except the auth endpoints, Next internals, and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
