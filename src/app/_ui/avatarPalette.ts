/**
 * `boring-avatars` needs concrete hex, but this app's theme is OKLCH custom
 * properties (globals.css) — so this is the one honest place a hex list
 * lives, each entry tied to a theme token by comment (T107). Values are
 * mid-tone so a 24px avatar reads on both `--background` (near-white in
 * light) and the dark card, and spread across the hue wheel so two members
 * rarely land the same colour. Verified legible in light and dark.
 */
export const AVATAR_PALETTE: readonly string[] = [
  "#6C5CE7", // --primary / --chart-1   violet
  "#8E44AD", // --chart-2               purple
  "#6495ED", // --chart-4               cornflower blue
  "#2E9E5B", // --credit                green (between the #1F7E3F light / #6FD488 dark values)
  "#6E774B", // --accent (light)        olive
  "#C77D3A", // warm counterpoint — the theme has no warm mid-tone (--debit is
  //            pure red, wrong for a face fill), so this one hue is chosen, not
  //            lifted from a token, to keep an all-cool set from clashing at 24px
];
