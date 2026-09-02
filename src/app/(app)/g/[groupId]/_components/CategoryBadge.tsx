import { isExpenseCategoryKey } from "../../../../../lib/categories";
import { es } from "../../../../../lib/i18n/es";

/**
 * The category of an expense, shown compactly on a feed row and in the
 * detail sheet (T090). Renders nothing when the expense is uncategorised
 * or carries an unknown key — the row simply omits it rather than showing
 * a placeholder. The label is text, not colour, so it needs no extra cue.
 */
export function CategoryBadge({ categoryKey }: { categoryKey: string | null }) {
  if (!isExpenseCategoryKey(categoryKey)) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground">
      {es.categories[categoryKey]}
    </span>
  );
}
