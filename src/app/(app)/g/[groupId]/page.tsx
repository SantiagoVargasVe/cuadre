import { apiFetchServer } from "../../../../lib/api/server";
import { expenseFiltersToQuery, parseExpenseFilters } from "../../../../lib/schemas/expenseFilters";
import { getGroupDetail, getMe } from "./_data";
import { ExpenseFeed } from "./_components/ExpenseFeed";
import { ExpenseExport } from "./_components/ExpenseExport";
import type { ExpenseListResult } from "./_components/types";

/** Gastos tab — server-rendered first page (T063), "load more" from there.
 * Group detail is fetched alongside for the add-expense form (T064): the
 * group's default currency and member list, both needed before the form
 * can even render its defaults. `getGroupDetail`/`getMe` are request-scoped
 * (`_data.ts`) — the group layout already resolved them, so these are cache
 * hits, not extra round trips (T106).
 *
 * Search and filters (T115) come from the query string, so a reload, a
 * back/forward, and a copied URL all render the same feed. Invalid values
 * are dropped rather than 400ing the page — see `parseExpenseFilters`. */
export default async function ExpensesTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { groupId } = await params;
  const filters = parseExpenseFilters(await searchParams);
  const filterQuery = expenseFiltersToQuery(filters);
  const [{ items, nextCursor }, { user }, { group, members }] = await Promise.all([
    apiFetchServer<ExpenseListResult>(
      filterQuery
        ? `/api/groups/${groupId}/expenses?${filterQuery}`
        : `/api/groups/${groupId}/expenses`,
    ),
    getMe(),
    getGroupDetail(groupId),
  ]);

  return (
    <div className="flex flex-col gap-3">
      {/* Export is the whole live ledger, never the filtered view (T080). */}
      <ExpenseExport groupId={groupId} />
      <ExpenseFeed
        // A filter change is a different feed, not an update to this one:
        // remounting drops the loaded pages and the cursor with them.
        key={filterQuery}
        groupId={groupId}
        myUserId={user.id}
        initialItems={items}
        initialCursor={nextCursor}
        filters={filters}
        members={members}
        defaultCurrency={group.defaultCurrency}
      />
    </div>
  );
}
