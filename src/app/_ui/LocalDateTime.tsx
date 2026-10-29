"use client";

import { useSyncExternalStore } from "react";
import { formatDateTime } from "../../lib/date/format";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** SSR cannot know the viewer's timezone. Start with explicit UTC, then
 * render local time after hydration without a server/client mismatch. */
export function LocalDateTime({ value }: { value: string }) {
  const local = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  // Even UTC Intl output differs across Node/browser CLDR versions (spaces
  // in es-CO's day period). ISO text is stable for the hydration snapshot.
  const utc = `${value.slice(0, 16).replace("T", " ")} UTC`;
  return <time dateTime={value}>{local ? formatDateTime(value) : utc}</time>;
}
