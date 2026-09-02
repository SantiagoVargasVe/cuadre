"use client";

import { EXPENSE_CATEGORY_KEYS, type ExpenseCategoryKey } from "../../../../../lib/categories";
import { cn } from "../../../../../lib/cn";
import { es } from "../../../../../lib/i18n/es";

const t = es.expenseForm;

export interface CategoryPickerProps {
  value: ExpenseCategoryKey | null;
  onChange: (value: ExpenseCategoryKey | null) => void;
}

/**
 * A horizontal row of toggle chips for the fixed category set (T090). It's
 * optional and starts unselected, so it never adds a step to "title,
 * amount, save" — tapping a chip sets the category, tapping the selected
 * one clears it back to `null`. Selection is carried by `aria-pressed` and
 * a check glyph, never colour alone (design-system.md).
 */
export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-medium text-foreground">
        {t.categoryLabel} <span className="font-normal text-muted-foreground">· {t.categoryHint}</span>
      </legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {EXPENSE_CATEGORY_KEYS.map((key) => {
          const selected = value === key;
          const label = es.categories[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              aria-label={selected ? t.categoryClear(label) : label}
              onClick={() => onChange(selected ? null : key)}
              className={cn(
                "inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-foreground hover:bg-muted/40",
              )}
            >
              {selected && (
                <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden>
                  <path
                    d="M2.5 6.5L5 9l4.5-5.5"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
