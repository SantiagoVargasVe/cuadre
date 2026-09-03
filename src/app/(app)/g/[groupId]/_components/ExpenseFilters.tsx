"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { es } from "../../../../../lib/i18n/es";
import {
  activeExpenseFilterCount,
  expenseFiltersToQuery,
  type ExpenseFilters as ExpenseFiltersValue,
} from "../../../../../lib/schemas/expenseFilters";
import { Button } from "../../../../_ui/Button";
import { ExpenseFilterFields } from "./ExpenseFilterFields";
import type { GroupMember } from "./types";

const t = es.expenseFilters;
const FIELDS_ID = "expense-filter-fields";

/**
 * Search plus a collapsed filter panel over the Gastos feed (T115).
 *
 * The URL is the source of truth: applying navigates, the server renders
 * the first filtered page, and every "Cargar más" from there carries the
 * same filters. Nothing here filters rows the client already holds — that
 * would hide matches sitting on a page nobody loaded.
 */
export function ExpenseFilters({
  groupId,
  filters,
  members,
}: {
  groupId: string;
  filters: ExpenseFiltersValue;
  members: GroupMember[];
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState(filters);
  const activeCount = activeExpenseFilterCount(filters);
  // Start open when something beyond the search box is already applied, so
  // a copied URL never hides the reason its feed looks short.
  const [open, setOpen] = React.useState(activeCount > (filters.q ? 1 : 0));

  function apply(next: ExpenseFiltersValue) {
    const query = expenseFiltersToQuery(next);
    router.push(query ? `/g/${groupId}?${query}` : `/g/${groupId}`);
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        apply(draft);
      }}
      className="rounded-lg border border-border bg-card p-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-foreground">
          {t.searchLabel}
          <input
            type="search"
            value={draft.q ?? ""}
            onChange={(event) => setDraft({ ...draft, q: event.target.value || undefined })}
            placeholder={t.searchPlaceholder}
            className="min-h-11 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <Button type="submit" className="min-h-11">
          {t.apply}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={FIELDS_ID}
          className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {activeCount > 0 ? t.filtersWithCount(activeCount) : t.filters}
        </button>
        {activeCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={() => {
              setDraft({});
              apply({});
            }}
          >
            {t.clear}
          </Button>
        )}
      </div>

      {open && (
        <ExpenseFilterFields id={FIELDS_ID} draft={draft} members={members} onChange={setDraft} />
      )}
    </form>
  );
}
