import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

// Reads the session and the database on every request; never prerender. On
// Render the SQLite disk only exists at runtime.
export const dynamic = "force-dynamic";

/**
 * Serve one person's profile picture.
 *
 * Signed-in only — pictures of staff and students are not public, and the
 * proxy (src/proxy.ts) already bounces cookieless requests to /login, so this
 * check is the real enforcement rather than the first line of it.
 *
 * Any signed-in user may read any picture: the same faces already appear as
 * chips throughout the app, so the image adds no visibility that a person
 * chip did not. What is scoped per viewer is booking links, not faces.
 *
 * Cached hard and privately. The URL carries a `?v=<upload time>` token
 * (see avatarUrl), so a changed picture is a changed URL and this can never
 * serve a stale face.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await getCurrentUser();
  if (!viewer) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const image = await prisma.avatarImage.findUnique({
    where: { userId: id },
    select: { bytes: true, mimeType: true },
  });
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.bytes.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
      // The stored type was sniffed from the bytes on upload, but belt and
      // braces: never let a browser second-guess it into something scriptable.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
