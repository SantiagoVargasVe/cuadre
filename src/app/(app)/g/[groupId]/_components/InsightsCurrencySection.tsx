"use client";

import { formatCalendarDate } from "../../../../../lib/date/format";
import { es } from "../../../../../lib/i18n/es";
import { TooltipContent, TooltipRoot, TooltipTrigger } from "../../../../_ui/Tooltip";
import { InsightsDetailSurface } from "../insights/_components/InsightsDetailSurface";
import { SummaryCard } from "../insights/_components/SummaryCard";
import type { CurrencyInsightsView } from "./insightsTypes";

/**
 * One currency's whole insight block, never summed with any other
 * block (frontend/CLAUDE.md § *Multi-currency display*). When the block is
 * a display-currency conversion it carries `pins`, and the "converted
 * rates" affordance names the date and source, the same as the balances
 * tab — an unlabelled converted chart is the same trust bug as an
 * unlabelled converted amount.
 */
export function InsightsCurrencySection({
  block,
  groupId,
  nameOf,
}: {
  block: CurrencyInsightsView;
  groupId: string;
  nameOf: (userId: string) => string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{block.currency}</h2>
        {block.pins && block.pins.length > 0 && (
          <TooltipRoot>
            <TooltipTrigger
              className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2"
              aria-label={es.balances.convertedMarkerLabel}
            >
              {es.balances.convertedMarkerLabel}
            </TooltipTrigger>
            <TooltipContent>
              {block.pins.map((pin) => (
                <p key={`${pin.fromCurrency}-${pin.toCurrency}`}>
                  {es.balances.pinLine(
                    pin.fromCurrency,
                    pin.toCurrency,
                    formatCalendarDate(pin.asOf),
                    pin.source,
                  )}
                </p>
              ))}
            </TooltipContent>
          </TooltipRoot>
        )}
      </div>
      <SummaryCard summary={block.summary} currency={block.currency} nameOf={nameOf} />
      <InsightsDetailSurface block={block} groupId={groupId} nameOf={nameOf} />
    </section>
  );
}
