import { es } from "../../../../../lib/i18n/es";

/** A plain download link keeps export available even when the feed is empty,
 * without fetching the private CSV into browser memory first (T080).
 *
 * It sends none of the feed's search/filter parameters and says so: the CSV
 * is the complete live ledger, which is the whole point of it being the
 * escape hatch nobody can be trapped by (T115). */
export function ExpenseExport({ groupId }: { groupId: string }) {
  return (
    <div className="flex flex-col gap-1">
      <a
        href={`/api/groups/${groupId}/expenses.csv`}
        download
        className="inline-flex h-10 items-center self-start rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {es.expenseFeed.export}
      </a>
      <p className="text-xs text-muted-foreground">{es.expenseFeed.exportHint}</p>
    </div>
  );
}
