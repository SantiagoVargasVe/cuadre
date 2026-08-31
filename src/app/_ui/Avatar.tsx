"use client";

import BoringAvatar from "boring-avatars";
import { resolveAvatar, type AvatarChoice } from "../../lib/avatar";
import { cn } from "../../lib/cn";

/**
 * A deterministic generated avatar for a member. Its inputs come from
 * `resolveAvatar(userId, chosen)`: a member who has picked one (T108) gets
 * their `{ variant, seed, palette }`; everyone else gets the T107 default
 * — variant `beam`, seeded by `userId` (never email; never `displayName`,
 * which would change on a rename). Pure SVG from `boring-avatars`,
 * in-process, no network.
 *
 * **Decorative only.** It always sits beside the name it belongs to, so
 * both the wrapper and the `<svg role="img">` are `aria-hidden` — a screen
 * reader gets the name, not a shape — and it is never the sole thing
 * distinguishing two members.
 */
export interface AvatarProps {
  userId: string;
  /** The member's stored choice, if any. `null`/absent → the T107 default. */
  avatar?: Partial<AvatarChoice> | null;
  /** Pixel size. 28 suits a list row; 20–24 for dense rows, 32+ for a
   * header. One number, not a wall of layout props. */
  size?: number;
  className?: string;
}

export function Avatar({ userId, avatar, size = 28, className }: AvatarProps) {
  const { variant, seed, colors } = resolveAvatar(userId, avatar);
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 overflow-hidden rounded-full", className)}
      style={{ width: size, height: size }}
    >
      <BoringAvatar name={seed} variant={variant} size={size} colors={[...colors]} square title={false} aria-hidden />
    </span>
  );
}
