import { isExpenseCategoryKey } from "../../../../../lib/categories";
import { formatCalendarDate, formatMonthLabel } from "../../../../../lib/date/format";
import { es } from "../../../../../lib/i18n/es";
import { formatMoney } from "../../../../../lib/money/format";
import type { Bar } from "../../../../_ui/charts/BarSeries";
import type { CategoryBucketView, MemberBucketView, PeriodBucketView } from "./insightsTypes";

const t = es.insights;

/** All amounts go through format.ts, never `Intl` at a call site (design-system.md § Money display). */
function money(amount: string, currency: string): string {
  return formatMoney({ amount: BigInt(amount), currency });
}

export interface ChartData {
  bars: Bar[];
  tableRows: { label: string; value: string }[];
}

/** `value` is only a bar-width ratio input; the exact amount is always `valueText`. */
function build(entries: { label: string; amount: string }[], currency: string): ChartData {
  return {
    bars: entries.map((entry) => ({
      label: entry.label,
      value: Number(entry.amount),
      valueText: money(entry.amount, currency),
    })),
    tableRows: entries.map((entry) => ({ label: entry.label, value: money(entry.amount, currency) })),
  };
}

export function periodChartData(
  buckets: PeriodBucketView[],
  currency: string,
  mode: "day" | "month",
): ChartData {
  return build(
    buckets.map((bucket) => ({
      label: mode === "month" ? formatMonthLabel(bucket.key) : formatCalendarDate(bucket.key),
      amount: bucket.amount,
    })),
    currency,
  );
}

export function memberChartData(
  buckets: MemberBucketView[],
  currency: string,
  nameOf: (userId: string) => string,
): ChartData {
  return build(
    buckets.map((bucket) => ({ label: nameOf(bucket.userId), amount: bucket.amount })),
    currency,
  );
}

export function categoryChartData(buckets: CategoryBucketView[], currency: string): ChartData {
  return build(
    buckets.map((bucket) => ({
      label: isExpenseCategoryKey(bucket.category) ? es.categories[bucket.category] : t.uncategorised,
      amount: bucket.amount,
    })),
    currency,
  );
}
