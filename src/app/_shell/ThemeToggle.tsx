"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { es } from "../../lib/i18n/es";
import { Button } from "../_ui/Button";

const t = es.nav;

/**
 * Renders nothing until mounted — `resolvedTheme` is undefined on the
 * server and on first client render, and guessing at it is exactly the
 * flash-of-wrong-theme bug suppressHydrationWarning on <html> exists to
 * avoid. An empty-but-sized placeholder keeps the header from jumping.
 */
export function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  React.useEffect(() => setMounted(true), []);

  if (!mounted) return <span className="size-8" aria-hidden />;

  const isDark = resolvedTheme === "dark";
  const label = isDark ? t.themeToLight : t.themeToDark;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="size-8 px-0"
      aria-label={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M15.8 4.2l-1.4 1.4M5.6 14.4l-1.4 1.4M15.8 15.8l-1.4-1.4M5.6 5.6 4.2 4.2"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        d="M17 11.5A7 7 0 1 1 8.5 3a5.5 5.5 0 0 0 8.5 8.5Z"
      />
    </svg>
  );
}
