import { z } from "zod";
import { AVATAR_PALETTE_NAMES, AVATAR_SEED_RE, AVATAR_VARIANTS } from "../avatar";

/**
 * `PUT /api/auth/avatar` body (T108). Either a full `{ variant, seed,
 * palette }` — each field validated against the app's own vocabulary, and
 * `seed` against the shape the editor generates, never free text — or
 * `null` to reset to the T107 default.
 */
export const avatarChoiceSchema = z
  .object({
    variant: z.enum(AVATAR_VARIANTS),
    seed: z.string().regex(AVATAR_SEED_RE, "must be an app-generated seed"),
    palette: z.enum(AVATAR_PALETTE_NAMES as [string, ...string[]]),
  })
  .nullable();

export type AvatarChoiceInput = z.infer<typeof avatarChoiceSchema>;
