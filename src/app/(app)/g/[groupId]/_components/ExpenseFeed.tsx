"use client";

import { es } from "../../../../../lib/i18n/es";
import type { ExpenseFilters as ExpenseFiltersValue } from "../../../../../lib/schemas/expenseFilters";
import { Button } from "../../../../_ui/Button";
import { AddExpenseFab } from "./AddExpenseFab";
import { EmptyState, NoMatchesState } from "./EmptyState";
import { ExpenseFilters } from "./ExpenseFilters";
import { ExpenseRow } from "./ExpenseRow";
import type { ExpenseSummary, GroupMember } from "./types";
import { useExpenseFeed } from "./useExpenseFeed";

const t = es.expenseFeed;

export interface ExpenseFeedProps {
  groupId: string;
  myUserId: string;
  initialItems: ExpenseSummary[];
  initialCursor: string | null;
  members: GroupMember[];
  defaultCurrency: string;
  /** Server-parsed from the URL (T115). The page keys this component by
   * them, so a filter change arrives as a remount with a fresh page. */
  filters?: ExpenseFiltersValue;
}

/**
 * The first page is server-rendered (frontend/CLAUDE.md § *Data loading*:
 * "renders from GET /api/groups/:id plus the tab's own endpoint") — this
 * component owns the search/filter surface, "load more", and reflecting a
 * write, which is the real interactivity a read-heavy feed needs.
 */
export function ExpenseFeed({
  groupId,
  myUserId,
  initialItems,
  initialCursor,
  members,
  defaultCurrency,
  filters = {},
}: ExpenseFeedProps) {
  const feed = useExpenseFeed({ groupId, initialItems, initialCursor, filters });

  return (
    <div className="flex flex-col gap-3 pb-20">
      <ExpenseFilters groupId={groupId} filters={filters} members={members} />
      {feed.items.length === 0 ? (
        feed.isFiltered ? <NoMatchesState groupId={groupId} /> : <EmptyState />
      ) : (
        <>
          {feed.items.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              groupId={groupId}
              myUserId={myUserId}
              members={members}
              onUpdated={feed.onUpdated}
              onDeleted={feed.onDeleted}
            />
          ))}
          {feed.cursor && (
            <Button variant="ghost" onClick={feed.loadMore} disabled={feed.loading}>
              {feed.loading ? t.loading : t.loadMore}
            </Button>
          )}
        </>
      )}
      <AddExpenseFab
        groupId={groupId}
        members={members}
        defaultCurrency={defaultCurrency}
        myUserId={myUserId}
        onCreated={feed.onCreated}
      />
    </div>
  );
}
