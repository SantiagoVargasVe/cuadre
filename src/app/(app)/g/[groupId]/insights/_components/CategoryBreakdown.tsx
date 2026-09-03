import Link from "next/link";
import { isExpenseCategoryKey } from "../../../../../../lib/categories";
import { es } from "../../../../../../lib/i18n/es";
import { Money } from "../../../../../_ui/Money";
import { BarSeries } from "../../../../../_ui/charts/BarSeries";
import { ChartFrame } from "../../../../../_ui/charts/ChartFrame";
import { HiddenDataTable } from "../../../../../_ui/charts/HiddenDataTable";
import { categoryChartData } from "../../_components/insightsBars";
import type { CategoryBucketView } from "../../_components/insightsTypes";

const t = es.insights;

function categoryName(category: string | null) {
  return isExpenseCategoryKey(category) ? es.categories[category] : t.uncategorised;
}

export function CategoryBreakdown({
  buckets,
  currency,
  groupId,
}: {
  buckets: CategoryBucketView[];
  currency: string;
  groupId: string;
}) {
  const [bucket] = buckets;
  if (!bucket) return <p className="text-sm text-muted-foreground">{t.noData}</p>;
  if (buckets.length === 1 && bucket.category === null) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">{t.category.allUncategorised}</p>
        <Link
          href={`/g/${groupId}`}
          className="inline-flex min-h-11 items-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {t.category.goToExpenses}
        </Link>
      </div>
    );
  }

  if (buckets.length === 1) {
    return (
      <p className="text-sm text-foreground">
        {t.category.singleCategory(categoryName(bucket.category))} <Money value={{ amount: BigInt(bucket.amount), currency }} />
      </p>
    );
  }

  const data = categoryChartData(buckets, currency);
  return (
    <ChartFrame
      title={t.byCategory}
      className="flex flex-col gap-3"
      captionClassName="sr-only"
      table={<HiddenDataTable caption={t.byCategory} columnLabels={[t.categoryColumn, t.amountColumn]} rows={data.tableRows} />}
    >
      <BarSeries title={t.byCategory} description={t.chartDescription(data.bars.length)} bars={data.bars} />
    </ChartFrame>
  );
}
