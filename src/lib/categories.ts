/**
 * The fixed, app-provided expense category set — decided 2026-09-01
 * (backlog/tasks/T090, roadmap.md § E10). **Not** free-form tags and
 * **not** per-group custom categories: reopening either needs an ADR, not
 * a follow-up task.
 *
 * Keys only. The Spanish labels live in `src/lib/i18n/es.ts` under
 * `categories.*`, like every other user-facing string — so a locale
 * change never rewrites stored data or an exported file.
 *
 * The order here is the display order and mirrors
 * `expense_categories.sort_order`, seeded in migration
 * `0009_expense_categories.sql`. A seventh category is an `INSERT` in a
 * new migration plus an entry here — never a schema alter.
 */
export const EXPENSE_CATEGORY_KEYS = [
  "comida",
  "alojamiento",
  "transporte",
  "mercado",
  "actividades",
  "otro",
] as const;

export type ExpenseCategoryKey = (typeof EXPENSE_CATEGORY_KEYS)[number];

/** Narrows an unknown wire/DB value to a known category key. */
export function isExpenseCategoryKey(value: unknown): value is ExpenseCategoryKey {
  return (
    typeof value === "string" && (EXPENSE_CATEGORY_KEYS as readonly string[]).includes(value)
  );
}
