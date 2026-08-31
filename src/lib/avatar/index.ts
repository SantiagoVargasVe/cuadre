/**
 * Everything `boring-avatars` derives an avatar from — variant, seed,
 * palette — as a bounded, app-owned vocabulary (T107, T108). Pure: shared
 * by the `<Avatar>` component, the avatar editor, and the API's Zod schema
 * so a stored value can only ever be one of these.
 */

export const AVATAR_VARIANTS = ["marble", "beam", "pixel", "sunset", "ring", "bauhaus"] as const;
export type AvatarVariant = (typeof AVATAR_VARIANTS)[number];

/**
 * Named palettes, each a list of concrete hex `boring-avatars` needs.
 * Every hue is one of the theme's own tokens flattened to sRGB (see
 * globals.css) — this is the single honest place those hexes live, the
 * same rule as T107. The client sends a **name**; raw hex from a client is
 * never stored.
 */
export const AVATAR_PALETTES = {
  // violet / purple / cornflower / green / olive + one warm hue the theme
  // has no mid-tone for — the T107 default set.
  default: ["#6C5CE7", "#8E44AD", "#6495ED", "#2E9E5B", "#6E774B", "#C77D3A"],
  // --primary / --chart-2 / --chart-4 / --chart-5 + two cool neighbours.
  cool: ["#6C5CE7", "#8E44AD", "#6495ED", "#4682B4", "#3AA6A0", "#5B6BE7"],
  // --accent (olive) / --debit family / warm ambers — for a warmer read.
  warm: ["#C77D3A", "#6E774B", "#B8543F", "#D9A441", "#8E7B4B", "#A0552F"],
} as const;
export type AvatarPaletteName = keyof typeof AVATAR_PALETTES;
export const AVATAR_PALETTE_NAMES = Object.keys(AVATAR_PALETTES) as AvatarPaletteName[];

export const DEFAULT_VARIANT: AvatarVariant = "beam";
export const DEFAULT_PALETTE: AvatarPaletteName = "default";

/** Seeds are app-generated (`nanoid`) — this is the shape the server
 * accepts back, never a free-text field. */
export const AVATAR_SEED_RE = /^[A-Za-z0-9_-]{6,24}$/;

export interface AvatarChoice {
  variant: AvatarVariant;
  seed: string;
  palette: AvatarPaletteName;
}

/** Stored user fields (each independently nullable — null means "the T107
 * default") + the user's id → the concrete inputs `<Avatar>` hands to
 * `boring-avatars`. Deterministic: the same stored value renders the same
 * on every device and every viewer's screen. */
export function resolveAvatar(
  userId: string,
  stored: Partial<AvatarChoice> | null | undefined,
): { variant: AvatarVariant; seed: string; colors: readonly string[] } {
  const variant = stored?.variant && AVATAR_VARIANTS.includes(stored.variant) ? stored.variant : DEFAULT_VARIANT;
  const seed = stored?.seed && AVATAR_SEED_RE.test(stored.seed) ? stored.seed : userId;
  const paletteName =
    stored?.palette && stored.palette in AVATAR_PALETTES ? stored.palette : DEFAULT_PALETTE;
  return { variant, seed, colors: AVATAR_PALETTES[paletteName] };
}
