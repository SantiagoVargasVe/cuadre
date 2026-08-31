"use client";

import BoringAvatar from "boring-avatars";
import { cn } from "../../lib/cn";
import { AVATAR_PALETTE } from "./avatarPalette";

/**
 * A deterministic generated avatar for a member (T107). Seeded by `userId`
 * so the same person renders the same shape and colour on every device and
 * every viewer's screen — and never by email (no endpoint returns a
 * co-member's) or `displayName` (renaming would change it on historical
 * rows). Pure SVG from `boring-avatars`, in-process, no network.
 *
 * **Decorative only.** It always sits beside the name it belongs to, so it
 * is `aria-hidden` — a screen reader gets the name, not a shape — and it is
 * never the sole thing distinguishing two members.
 *
 * The default variant is `beam`: at 24–32px, the size that matters here,
 * its little faces stay the most distinct of the six. T108 will let a
 * member change it.
 */
export interface AvatarProps {
  userId: string;
  /** Only used to pick a defensive fallback seed if `userId` is somehow
   * empty; never rendered and never the avatar's seed otherwise. */
  displayName?: string;
  /** Pixel size. 28 suits a list row; pass 20–24 for dense rows, 32 for a
   * header. One number, not a wall of layout props. */
  size?: number;
  className?: string;
}

export function Avatar({ userId, displayName, size = 28, className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 overflow-hidden rounded-full", className)}
      style={{ width: size, height: size }}
    >
      <BoringAvatar
        name={userId || displayName || "?"}
        variant="beam"
        size={size}
        colors={[...AVATAR_PALETTE]}
        square
        title={false}
        aria-hidden
      />
    </span>
  );
}
