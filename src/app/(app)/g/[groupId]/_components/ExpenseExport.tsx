import { es } from "../../../../../lib/i18n/es";

/** A plain download link keeps export available even when the feed is empty,
 * without fetching the private CSV into browser memory first (T080). */
export function ExpenseExport({ groupId }: { groupId: string }) {
  return (
    <a
      href={`/api/groups/${groupId}/expenses.csv`}
      download
      className="inline-flex h-10 items-center self-start rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {es.expenseFeed.export}
    </a>
  );
}
