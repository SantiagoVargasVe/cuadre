import { es } from "../../../../../../lib/i18n/es";
import { BarSeries } from "../../../../../_ui/charts/BarSeries";
import { ChartFrame } from "../../../../../_ui/charts/ChartFrame";
import { HiddenDataTable } from "../../../../../_ui/charts/HiddenDataTable";
import { periodChartData } from "../../_components/insightsBars";
import type { PeriodBucketView } from "../../_components/insightsTypes";

const t = es.insights;

export function SpendingEvolution({
  buckets,
  currency,
  mode,
  headingId,
}: {
  buckets: PeriodBucketView[];
  currency: string;
  mode: "day" | "month";
  headingId: string;
}) {
  const data = periodChartData(buckets, currency, mode);
  if (data.bars.length < 2) return null;

  return (
    <section className="flex flex-col gap-3 p-4" aria-labelledby={headingId}>
      <h3 id={headingId} className="text-sm font-semibold text-foreground">
        {t.overTime}
      </h3>
      <ChartFrame
        title={t.overTime}
        className="flex flex-col gap-3"
        captionClassName="sr-only"
        table={<HiddenDataTable caption={t.overTime} columnLabels={[t.periodColumn, t.amountColumn]} rows={data.tableRows} />}
      >
        <BarSeries title={t.overTime} description={t.chartDescription(data.bars.length)} bars={data.bars} />
      </ChartFrame>
    </section>
  );
}
