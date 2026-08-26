"use client";

import * as React from "react";
import { apiFetch } from "../../../../../lib/api/client";
import { es } from "../../../../../lib/i18n/es";
import { Button } from "../../../../_ui/Button";
import { AddExpenseFab } from "./AddExpenseFab";
import { EmptyState } from "./EmptyState";
import { ExpenseRow } from "./ExpenseRow";
import type { ExpenseListResult, ExpenseSummary } from "./types";

const t = es.expenseFeed;

export interface ExpenseFeedProps {
  groupId: string;
  myUserId: string;
  initialItems: ExpenseSummary[];
  initialCursor: string | null;
}

/**
 * The first page is server-rendered (frontend/CLAUDE.md § *Data loading*:
 * "renders from GET /api/groups/:id plus the tab's own endpoint") — this
 * component just owns "load more" from there on, the one piece of real
 * interactivity a read-heavy feed needs.
 */
export function ExpenseFeed({ groupId, myUserId, initialItems, initialCursor }: ExpenseFeedProps) {
  const [items, setItems] = React.useState(initialItems);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [loading, setLoading] = React.useState(false);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    try {
      const page = await apiFetch<ExpenseListResult>(
        `/api/groups/${groupId}/expenses?cursor=${encodeURIComponent(cursor)}`,
      );
      // The cursor is (date, id) descending — appending never revisits an
      // id already on the page, so this can't duplicate a row even on a
      // day with several expenses (services/expenses.ts § listExpenses).
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 pb-20">
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {items.map((expense) => (
            <ExpenseRow key={expense.id} expense={expense} myUserId={myUserId} />
          ))}
          {cursor && (
            <Button variant="ghost" onClick={loadMore} disabled={loading}>
              {loading ? t.loading : t.loadMore}
            </Button>
          )}
        </>
      )}
      <AddExpenseFab />
    </div>
  );
}
