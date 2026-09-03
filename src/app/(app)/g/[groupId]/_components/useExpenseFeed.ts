"use client";

import * as React from "react";
import { apiFetch } from "../../../../../lib/api/client";
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
 * there, and how a create/edit/delete updates what's on screen.
 *
 * The page keys `<ExpenseFeed>` by the serialized filters, so a filter
 * change arrives here as a remount with a fresh first page — there is no
 * effect mirroring props into state.
 */
export function useExpenseFeed({
  groupId,
  initialItems,
  initialCursor,
  filters,
}: UseExpenseFeedArgs) {
  const [items, setItems] = React.useState(initialItems);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [loading, setLoading] = React.useState(false);
  const filterQuery = expenseFiltersToQuery(filters);
  const isFiltered = activeExpenseFilterCount(filters) > 0;
  const endpoint = `/api/groups/${groupId}/expenses`;

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    try {
      // Every page carries the same filters — they're applied in SQL before
      // the cursor, so a filtered feed paginates exactly like an unfiltered
      // one (services/expenses.ts § filterConditions).
      const params = new URLSearchParams(filterQuery);
      params.set("cursor", cursor);
      const page = await apiFetch<ExpenseListResult>(`${endpoint}?${params}`);
      // The cursor is (date, id) descending — appending never revisits an
      // id already on the page, so this can't duplicate a row even on a
      // day with several expenses (services/expenses.ts § listExpenses).
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  /**
   * A write under an active filter can move a row *into* or *out of* the
   * result — a retitled expense, a changed category, a new date. Only the
   * server knows which, so re-read the first filtered page instead of
   * guessing from the payload. Unfiltered, the local update still stands.
   */
  async function refetchFiltered() {
    const page = await apiFetch<ExpenseListResult>(
      filterQuery ? `${endpoint}?${filterQuery}` : endpoint,
    );
    setItems(page.items);
    setCursor(page.nextCursor);
  }

  return {
    items,
    cursor,
    loading,
    isFiltered,
    loadMore,
    onCreated(expense: ExpenseSummary) {
      if (isFiltered) return void refetchFiltered();
      setItems((current) => [expense, ...current]);
    },
    onUpdated(expense: ExpenseSummary) {
      if (isFiltered) return void refetchFiltered();
      setItems((current) => current.map((item) => (item.id === expense.id ? expense : item)));
    },
    onDeleted(expenseId: string) {
      if (isFiltered) return void refetchFiltered();
      setItems((current) => current.filter((item) => item.id !== expenseId));
    },
  };
}
