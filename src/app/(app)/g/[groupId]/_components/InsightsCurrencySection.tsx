"use client";

import { formatCalendarDate } from "../../../../../lib/date/format";
import { es } from "../../../../../lib/i18n/es";
import { TooltipContent, TooltipRoot, TooltipTrigger } from "../../../../_ui/Tooltip";
import { BarSeries } from "../../../../_ui/charts/BarSeries";
import { ChartFrame } from "../../../../_ui/charts/ChartFrame";
import { HiddenDataTable } from "../../../../_ui/charts/HiddenDataTable";
import { MemberBreakdown } from "../insights/_components/MemberBreakdown";
import { SummaryCard } from "../insights/_components/SummaryCard";
import { categoryChartData, periodChartData, type ChartData } from "./insightsBars";
import type { CurrencyInsightsView } from "./insightsTypes";

const t = es.insights;

/** One chart: the SVG when there's data, a calm line when there isn't, plus the sr-only table either way. */
function Chart({ title, unit, data }: { title: string; unit: string; data: ChartData }) {
  return (
    <ChartFrame
      title={title}
      table={<HiddenDataTable caption={title} columnLabels={[unit, t.amountColumn]} rows={data.tableRows} />}
    >
      {data.bars.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noData}</p>
      ) : (
        <BarSeries title={title} description={t.chartDescription(data.bars.length)} bars={data.bars} />
      )}
    </ChartFrame>
  );
}

/**
 * One currency's whole picture — three charts, never summed with any other
 * block (frontend/CLAUDE.md § *Multi-currency display*). When the block is
 * a display-currency conversion it carries `pins`, and the "converted
 * rates" affordance names the date and source, the same as the balances
 * tab — an unlabelled converted chart is the same trust bug as an
 * unlabelled converted amount.
 */
export function InsightsCurrencySection({
  block,
  nameOf,
}: {
  block: CurrencyInsightsView;
  nameOf: (userId: string) => string;
}) {
  const mode = block.byMonth.length > 1 ? "month" : "day";
  const overTime = periodChartData(mode === "month" ? block.byMonth : block.byDay, block.currency, mode);

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
      <Chart title={t.overTime} unit={t.periodColumn} data={overTime} />
      <MemberBreakdown members={block.members} currency={block.currency} nameOf={nameOf} />
      <Chart title={t.byCategory} unit={t.categoryColumn} data={categoryChartData(block.byCategory, block.currency)} />
    </section>
  );
}
