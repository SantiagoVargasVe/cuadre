import { formatCalendarDate } from "../../lib/date/format";
import { formatMoney } from "../../lib/money/format";
import type { Money as MoneyValue } from "../../lib/money/types";
import { cn } from "../../lib/cn";
import { es } from "../../lib/i18n/es";
import { TooltipContent, TooltipRoot, TooltipTrigger } from "./Tooltip";

const t = es.money;

export interface MoneyProps {
  value: MoneyValue;
  /** Prefixes a positive amount with `+` — for net positions, never expense totals. */
  signed?: boolean;
  /** The pre-conversion amount and the date the group's rate was pinned.
   * Marks the figure as converted, per design-system.md § *Money display*
   * — an unlabelled converted number is a trust bug. */
  converted?: { original: MoneyValue; pinnedAt: string };
  className?: string;
}

/**
 * The one component that renders money (design-system.md § *Money
 * display*). Never format inline, never call `Intl` outside
 * `src/lib/money/format.ts`.
 */
export function Money({ value, signed, converted, className }: MoneyProps) {
  const formatted = formatMoney(value, { signed });

  if (!converted) {
    return <span className={cn("tabular-nums", className)}>{formatted}</span>;
  }

  return (
    <span className={cn("tabular-nums", className)}>
      {formatted}
      <TooltipRoot>
        <TooltipTrigger
          className="ml-0.5 align-super text-[0.65em] text-muted-foreground underline decoration-dotted underline-offset-2"
          aria-label={t.convertedMarkerLabel}
        >
          *
        </TooltipTrigger>
        <TooltipContent>
          {t.convertedFrom(formatMoney(converted.original), formatCalendarDate(converted.pinnedAt))}
        </TooltipContent>
      </TooltipRoot>
    </span>
  );
}
