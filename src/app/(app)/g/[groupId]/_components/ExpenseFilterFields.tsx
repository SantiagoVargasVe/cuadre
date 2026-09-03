"use client";

import { EXPENSE_CATEGORY_KEYS } from "../../../../../lib/categories";
import { es } from "../../../../../lib/i18n/es";
import { KNOWN_CURRENCIES } from "../../../../../lib/money/format";
import {
  UNCATEGORISED_FILTER,
  type ExpenseFilters,
} from "../../../../../lib/schemas/expenseFilters";
import { ANY_VALUE, FilterSelect } from "./FilterSelect";
import type { GroupMember } from "./types";

const t = es.expenseFilters;

/** The body of the Filtros disclosure. Two columns from `sm` up, one
 * stacked column on a phone; every control is at least 44px tall. */
export function ExpenseFilterFields({
  id,
  draft,
  members,
  onChange,
}: {
  id: string;
  draft: ExpenseFilters;
  members: GroupMember[];
  onChange: (next: ExpenseFilters) => void;
}) {
  const set = (patch: Partial<ExpenseFilters>) => onChange({ ...draft, ...patch });

  return (
    <div id={id} className="mt-3 grid gap-3 sm:grid-cols-2">
      <FilterSelect
        label={t.categoryLabel}
        value={draft.category}
        onChange={(value) => set({ category: value as ExpenseFilters["category"] })}
        options={[
          { value: ANY_VALUE, label: t.allCategories },
          // Uncategorised is a filter the data actually needs — T090 made
          // the category optional, so "sin categoría" is a real bucket.
          { value: UNCATEGORISED_FILTER, label: t.uncategorised },
          ...EXPENSE_CATEGORY_KEYS.map((key) => ({ value: key, label: es.categories[key] })),
        ]}
      />
      <FilterSelect
        label={t.memberLabel}
        value={draft.member}
        onChange={(value) => set({ member: value })}
        options={[
          { value: ANY_VALUE, label: t.allMembers },
          ...members.map((member) => ({ value: member.userId, label: member.displayName })),
        ]}
      />
      <FilterSelect
        label={t.currencyLabel}
        value={draft.currency}
        onChange={(value) => set({ currency: value })}
        options={[
          { value: ANY_VALUE, label: t.allCurrencies },
          ...KNOWN_CURRENCIES.map((code) => ({ value: code, label: code })),
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <DateFilter label={t.fromLabel} value={draft.from} onChange={(v) => set({ from: v })} />
        <DateFilter label={t.toLabel} value={draft.to} onChange={(v) => set({ to: v })} />
      </div>
    </div>
  );
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
      {label}
      <input
        type="date"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        className="min-h-11 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}
