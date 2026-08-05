/**
 * Profile pictures: the rules both sides of the upload agree on.
 *
 * Pictures are resized and re-encoded to WebP in the BROWSER before they are
 * sent (see components/forms/avatar-form.tsx), which keeps the payload under
 * the 1MB server-action body limit without a native image dependency on the
 * server. The server still re-checks size and sniffs the real format, because
 * nothing a client sends is trustworthy.
 *
 * No `server-only` import here on purpose: the client form needs these
 * constants too.
 */

/** Stored edge length. Chips render at 20-24px, the profile header at 96px. */
export const AVATAR_PX = 256;

/**
 * Server-side ceiling on the stored bytes. A 256px WebP lands around 20-40KB,
 * so this is generous headroom for an awkward image rather than a target.
 */
export const AVATAR_MAX_BYTES = 300 * 1024;

/** What a picture may be sent as. The browser resize emits the first one. */
export const AVATAR_MIME_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;

/** What the file picker offers, including formats we re-encode away. */
export const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif";

/** Enough of a person to build their picture URL. */
export type AvatarPerson = { id: string; avatarUpdatedAt?: Date | null };

/**
 * Where a person's picture is served from, or null when they have none.
 *
 * The `v` token is the upload timestamp, which lets /api/avatar/[id] answer
 * with a one-year immutable cache: a new upload changes the URL, so a stale
 * picture can never stick around, and re-renders never re-fetch bytes.
 */
export function avatarUrl(person: AvatarPerson): string | null {
  if (!person.avatarUpdatedAt) return null;
  return `/api/avatar/${person.id}?v=${person.avatarUpdatedAt.getTime()}`;
}

/**
 * The image format the BYTES actually are, ignoring whatever the upload
 * claimed. We serve these bytes back to browsers, so a file labelled
 * `image/webp` that is really HTML would be a stored-XSS vector; the route
 * sends this sniffed type (plus `nosniff`) instead of the client's word.
 *
 * Returns null for anything that isn't one of the three formats we accept.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  const startsWith = (offset: number, ...sig: number[]) =>
    sig.every((byte, i) => bytes[offset + i] === byte);

  // PNG: \x89PNG\r\n\x1a\n
  if (startsWith(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return "image/png";
  }
  // JPEG: SOI marker.
  if (startsWith(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  // WebP: "RIFF" .... "WEBP"
  if (startsWith(0, 0x52, 0x49, 0x46, 0x46) && startsWith(8, 0x57, 0x45, 0x42, 0x50)) {
    return "image/webp";
  }
  return null;
}
