/**
 * Formats a calendar date (`YYYY-MM-DD`, no time, no zone — CLAUDE.md
 * "Dates on an expense are calendar dates") for display. Anchored at UTC
 * midnight and formatted in UTC, so the displayed day never shifts with
 * the viewer's own timezone — the same bug class T060's `<Money>` pin-date
 * formatting exists to avoid.
 */
const CALENDAR_DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatCalendarDate(isoDate: string): string {
  return CALENDAR_DATE_FORMATTER.format(new Date(`${isoDate}T00:00:00Z`));
}

/**
 * Formats a real instant (`editedAt`, `createdAt` — RFC 3339 UTC,
 * api-contract.md § *Conventions*), as opposed to a calendar date. Shown
 * in the viewer's own local time, deliberately — unlike a calendar date,
 * an edit is a point in time and "when" should mean when it happened for
 * whoever's reading it.
 */
const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatTimestamp(isoInstant: string): string {
  return TIMESTAMP_FORMATTER.format(new Date(isoInstant));
}
