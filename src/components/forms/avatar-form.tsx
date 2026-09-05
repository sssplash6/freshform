"use client";

import { useState } from "react";

import { Avatar } from "@/components/avatar";
import { Button, buttonClasses } from "@/components/ui/button";
import { SaveState, saveStateFrom } from "@/components/ui/save-state";
import { removeOwnAvatar, setOwnAvatar } from "@/lib/actions/profile";
import { AVATAR_ACCEPT, AVATAR_PX } from "@/lib/avatar";
import type { ActionState } from "@/lib/actions/shared";

/**
 * Square-crop, downscale, and re-encode a chosen image entirely in the browser.
 *
 * Doing it here rather than on the server is what keeps `sharp` (a native
 * dependency that has to build on Render) out of the project, and it means a
 * 6MB phone photo becomes ~30KB before it ever touches the network — well under
 * the 1MB server-action body limit.
 *
 * `imageOrientation: "from-image"` matters: without it, portrait photos from
 * phones arrive rotated, because the rotation lives in EXIF rather than in the
 * pixels.
 */
async function toSquareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    // Center crop to a square before scaling, so faces aren't squashed.
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_PX;
    canvas.height = AVATAR_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't process images.");
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_PX,
      AVATAR_PX
    );

    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
    // Every current browser encodes WebP; the JPEG fallback covers the ones
    // that quietly return null instead of erroring.
    const blob = (await encode("image/webp")) ?? (await encode("image/jpeg"));
    if (!blob) throw new Error("This browser can't process images.");
    return blob;
  } finally {
    bitmap.close();
  }
}

/**
 * The mentor's own profile picture: what they look like now, a button to
 * replace it, and one to drop back to their initials badge.
 *
 * A local preview goes up the moment the resize finishes, so the change reads
 * as instant even though the server round-trip and revalidation follow.
 */
export function AvatarForm({
  person,
}: {
  person: {
    id: string;
    name: string | null;
    email: string;
    avatarUpdatedAt: Date | null;
  };
}) {
  const [state, setState] = useState<ActionState>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const hasPicture = Boolean(preview ?? person.avatarUpdatedAt);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Let the same file be picked again after a failure.
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setState(null);
    try {
      const resized = await toSquareImage(file);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(resized);
      });

      const body = new FormData();
      body.append("avatar", resized, "avatar.webp");
      setState(await setOwnAvatar(body));
    } catch (error) {
      setPreview(null);
      setState({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "That image couldn't be read. Try a PNG or JPEG.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    setState(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setState(await removeOwnAvatar());
    setBusy(false);
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        {/* A local object URL for the picture just chosen — nothing for the
            next/image optimizer to fetch or improve. */}
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="h-24 w-24 shrink-0 rounded-full bg-canvas object-cover sm:h-28 sm:w-28"
          />
        ) : (
          <Avatar
            person={person}
            className="h-24 w-24 text-3xl sm:h-28 sm:w-28"
          />
        )}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={buttonClasses(
                "secondary",
                "sm",
                busy ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              )}
            >
              {busy ? "Working…" : hasPicture ? "Change picture" : "Upload picture"}
              <input
                type="file"
                accept={AVATAR_ACCEPT}
                disabled={busy}
                onChange={onPick}
                className="sr-only"
              />
            </label>
            {hasPicture && (
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={onRemove}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-fg">
            Square works best — anything else is cropped from the middle. Shown
            next to your name everywhere in the app.
          </p>
        </div>
      </div>
      <SaveState state={saveStateFrom(state, busy)} />
    </div>
  );
}
