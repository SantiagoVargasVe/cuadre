"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../../../lib/api/client";
import { liveGroupRead, livePollInterval } from "../../../../../lib/query/liveGroupQuery";
import {
  activeExpenseFilterCount,
  expenseFiltersToQuery,
  type ExpenseFilters,
} from "../../../../../lib/schemas/expenseFilters";
import type { ExpenseListResult, ExpenseSummary } from "./types";

export interface UseExpenseFeedArgs {
  groupId: string;
  initialItems: ExpenseSummary[];
  initialCursor: string | null;
  filters: ExpenseFilters;
}

/**
 * The Gastos feed's data: the server-rendered first page, "load more" from
 * there, and staying current while other members add expenses (T117).
 *
 * The filters are part of the query key, so a filter change is a different
 * cache entry rather than an update to this one — there is no effect
 * mirroring props into state, and no cursor to reset by hand.
 *
 * A write doesn't patch the list. Every create/edit/delete invalidates this
 * key and the server answers again, because under an active filter a write
 * can move a row *into* or *out of* the result — a retitled expense, a
 * changed category, a new date — and only the server knows which. Doing it
 * the same way unfiltered is one code path instead of two, and it keeps this
 * non-optimistic: the server resolves the split (design-system.md § *Data*).
 */
export function useExpenseFeed({
  groupId,
  initialItems,
  initialCursor,
  filters,
}: UseExpenseFeedArgs) {
  const queryClient = useQueryClient();
  const filterQuery = expenseFiltersToQuery(filters);
  const isFiltered = activeExpenseFilterCount(filters) > 0;
  const endpoint = `/api/groups/${groupId}/expenses`;
  const queryKey = ["group", groupId, "expenses", filterQuery];

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => {
      // Every page carries the same filters — they're applied in SQL before
      // the cursor, so a filtered feed paginates exactly like an unfiltered
      // one (services/expenses.ts § filterConditions).
      const params = new URLSearchParams(filterQuery);
      if (pageParam) params.set("cursor", pageParam);
      const search = params.toString();
      return apiFetch<ExpenseListResult>(search ? `${endpoint}?${search}` : endpoint);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last: ExpenseListResult) => last.nextCursor,
    // The page this component was rendered with. Fresh for `staleTime`, so
    // first paint costs no request — the server already paid for it (T106).
    initialData: {
      pages: [{ items: initialItems, nextCursor: initialCursor }],
      pageParams: [null],
    },
    ...liveGroupRead,
    refetchInterval: ({ state }) => livePollInterval(state.data?.pages.length ?? 1),
  });

  // The cursor is (date, id) descending, so concatenating pages never
  // revisits an id already shown — not even on a day with several expenses
  // (services/expenses.ts § listExpenses).
  const items = query.data.pages.flatMap((page) => page.items);
  const invalidate = () => void queryClient.invalidateQueries({ queryKey });

  return {
    items,
    cursor: query.hasNextPage ? (query.data.pages.at(-1)?.nextCursor ?? null) : null,
    loading: query.isFetchingNextPage,
    isFiltered,
    loadMore: () => void query.fetchNextPage(),
    onCreated: invalidate,
    onUpdated: invalidate,
    onDeleted: invalidate,
  };
}
