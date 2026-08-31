import "server-only";
import type { AvatarChoice } from "../../lib/avatar";
import { users } from "./schema";

/** The user's avatar columns, for `.select()` alongside `displayName`
 * wherever a member is returned (T108). */
export const avatarColumns = {
  avatarVariant: users.avatarVariant,
  avatarSeed: users.avatarSeed,
  avatarPalette: users.avatarPalette,
};

interface AvatarRow {
  avatarVariant: string | null;
  avatarSeed: string | null;
  avatarPalette: string | null;
}

/**
 * The three stored columns → the wire's `avatar` field. `null` when the
 * member hasn't chosen one (all three null) — the client's `resolveAvatar`
 * then falls back to the T107 default. Shape validation happened at the
 * write boundary; this trusts the row.
 */
export function toAvatarChoice(row: AvatarRow): AvatarChoice | null {
  if (row.avatarVariant == null && row.avatarSeed == null && row.avatarPalette == null) {
    return null;
  }
  return {
    variant: row.avatarVariant as AvatarChoice["variant"],
    seed: row.avatarSeed as string,
    palette: row.avatarPalette as AvatarChoice["palette"],
  };
}
