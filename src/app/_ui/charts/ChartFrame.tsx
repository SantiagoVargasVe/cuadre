import type * as React from "react";

/**
 * The shared shell for an insights chart (T081): a caption that may be
 * visually hidden when the surrounding section already names the chart,
 * the hand-rolled SVG (which carries its own `role="img"`
 * plus `<title>`/`<desc>`), and — as a sibling, not inside the image —
 * the same numbers as a visually-hidden `<table>`, so a screen-reader
 * user gets the data rather than just "chart". T082/T084 reuse this.
 */
export function ChartFrame({
  title,
  children,
  table,
  className = "flex flex-col gap-3 rounded-lg border border-border bg-card p-4",
  captionClassName = "text-sm font-semibold text-foreground",
}: {
  title: string;
  children: React.ReactNode;
  table: React.ReactNode;
  className?: string;
  captionClassName?: string;
}) {
  return (
    <figure className={className}>
      <figcaption className={captionClassName}>{title}</figcaption>
      {children}
      {table}
    </figure>
  );
}
