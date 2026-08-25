import { Montserrat, Source_Code_Pro } from "next/font/google";

/**
 * Fonts for the Cuadre theme.
 *
 * Loaded through `next/font`, not a <link> to Google Fonts: it self-hosts the
 * files at build time, so there is no third-party request at runtime and no
 * layout shift while a face downloads.
 *
 * `latin` covers every character Spanish needs (á é í ó ú ü ñ ¿ ¡). `latin-ext`
 * is not required and would only add weight.
 *
 * Playfair Display is intentionally absent. The theme defines `--font-serif`
 * for completeness, but this app has no editorial surface and shipping an
 * unused ~120 KB face is pure cost. If a serif is ever wanted, add it here and
 * point `--font-serif` at its variable in globals.css.
 */

export const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
});

export const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-source-code-pro",
});

/** Spread onto <html> in the root layout, alongside the theme class. */
export const fontVariables = `${montserrat.variable} ${sourceCodePro.variable}`;
