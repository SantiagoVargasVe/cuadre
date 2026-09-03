import Link from "next/link";
import { es } from "../../../../../lib/i18n/es";

const t = es.expenseFeed.empty;

export function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
      <p className="font-medium text-foreground">{t.title}</p>
      <p className="text-sm text-muted-foreground">{t.body}</p>
    </div>
  );
}

/**
 * The *filtered* feed's empty state (T115). Deliberately not `EmptyState`:
 * "nothing matches these filters" is an actionable filter problem, and
 * showing "Aún no hay gastos" over a group full of expenses would be a lie.
 * Clearing is a link because it is a URL change, not local state.
 */
export function NoMatchesState({ groupId }: { groupId: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-8 text-center">
      <p className="font-medium text-foreground">{es.expenseFilters.empty.title}</p>
      <p className="text-sm text-muted-foreground">{es.expenseFilters.empty.body}</p>
      <Link
        href={`/g/${groupId}`}
        className="inline-flex min-h-11 items-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {es.expenseFilters.clear}
      </Link>
    </div>
  );
}
