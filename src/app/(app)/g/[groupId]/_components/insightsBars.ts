import { isExpenseCategoryKey } from "../../../../../lib/categories";
import { formatCalendarDate, formatMonthLabel } from "../../../../../lib/date/format";
import { es } from "../../../../../lib/i18n/es";
import { formatMoney } from "../../../../../lib/money/format";
import type { Bar } from "../../../../_ui/charts/BarSeries";
import type { PairedRow } from "../../../../_ui/charts/PairedBars";
import type { CategoryBucketView, MemberBreakdownView, PeriodBucketView } from "./insightsTypes";

const t = es.insights;
const bt = es.balances;

/** All amounts go through format.ts, never `Intl` at a call site (design-system.md § Money display). */
function money(amount: string, currency: string): string {
  return formatMoney({ amount: BigInt(amount), currency });
}

export interface ChartData {
  bars: Bar[];
  tableRows: { label: string; values: string[] }[];
}

/** `value` is only a bar-width ratio input; the exact amount is always the text. */
function build(entries: { label: string; amount: string }[], currency: string): ChartData {
  return {
    bars: entries.map((entry) => ({
      label: entry.label,
      value: Number(entry.amount),
      valueText: money(entry.amount, currency),
    })),
    tableRows: entries.map((entry) => ({ label: entry.label, values: [money(entry.amount, currency)] })),
  };
}

export function periodChartData(buckets: PeriodBucketView[], currency: string, mode: "day" | "month"): ChartData {
  return build(
    buckets.map((bucket) => ({
      label: mode === "month" ? formatMonthLabel(bucket.key) : formatCalendarDate(bucket.key),
      amount: bucket.amount,
    })),
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

/** Net as a word plus the absolute amount, never a bare signed number — same rule as the balances tab. */
export function netText(net: bigint, currency: string): { text: string; className: string } {
  const formatted = formatMoney({ amount: net < 0n ? -net : net, currency });
  if (net > 0n) return { text: bt.netIsOwed(formatted), className: "text-credit" };
  if (net < 0n) return { text: bt.netOwes(formatted), className: "text-debit" };
  return { text: bt.netSettled, className: "text-settled" };
}

export interface MemberBreakdownData {
  pairedRows: PairedRow[];
  netLines: { userId: string; name: string; text: string; className: string }[];
  tableRows: { label: string; values: string[] }[];
}

export function memberBreakdownData(
  members: MemberBreakdownView[],
  currency: string,
  nameOf: (userId: string) => string,
): MemberBreakdownData {
  return {
    pairedRows: members.map((member) => ({
      label: nameOf(member.userId),
      a: { value: Number(member.paid), valueText: money(member.paid, currency) },
      b: { value: Number(member.consumed), valueText: money(member.consumed, currency) },
    })),
    netLines: members.map((member) => ({
      userId: member.userId,
      name: nameOf(member.userId),
      ...netText(BigInt(member.currentNet), currency),
    })),
    tableRows: members.map((member) => ({
      label: nameOf(member.userId),
      values: [
        money(member.paid, currency),
        money(member.consumed, currency),
        netText(BigInt(member.currentNet), currency).text,
      ],
    })),
  };
}
