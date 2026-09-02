import { formatCalendarDate } from "../../../../../../lib/date/format";
import { es } from "../../../../../../lib/i18n/es";
import { Money } from "../../../../../_ui/Money";
import type { SummaryView } from "../../_components/insightsTypes";

const t = es.insights.summary;

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{children}</span>
    </div>
  );
}

/**
 * The one-glance card at the top of a currency's insights (T084): total,
 * count, span, average, largest expense, and who's currently fronting the
 * trip. Every figure is server-computed and rendered through `<Money>`;
 * "who's carrying" is a sentence over T082's settlement-aware `currentNet`,
 * never a bare signed number.
 */
export function SummaryCard({
  summary,
  currency,
  nameOf,
}: {
  summary: SummaryView;
  currency: string;
  nameOf: (userId: string) => string;
}) {
  if (summary.expenseCount === 0) {
    return (
      <section className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        {t.noExpenses}
      </section>
    );
  }

  const money = (amount: string) => <Money value={{ amount: BigInt(amount), currency }} />;
  const largest = summary.largestExpense;

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{t.heading}</h3>
      <Stat label={t.totalSpent}>{money(summary.totalSpent)}</Stat>
      <Stat label={t.expenseCount}>{t.expenses(summary.expenseCount)}</Stat>
      {summary.firstExpenseDate && summary.lastExpenseDate && (
        <Stat label={t.span}>
          {t.dateRange(
            formatCalendarDate(summary.firstExpenseDate),
            formatCalendarDate(summary.lastExpenseDate),
          )}
        </Stat>
      )}
      <Stat label={t.average}>{money(summary.averagePerExpense)}</Stat>
      {largest && (
        <Stat label={t.largest}>
          <span className="font-normal text-muted-foreground">{largest.title} · </span>
          {money(largest.amount)}
          <span className="font-normal text-muted-foreground"> · {t.paidBy(largest.payers.join(", "))}</span>
        </Stat>
      )}
      <p className="pt-1 text-sm text-foreground">
        {summary.carrying ? (
          <>
            {t.carryingLead(nameOf(summary.carrying.userId))}{" "}
            <Money
              value={{ amount: BigInt(summary.carrying.amount), currency }}
              className="font-medium text-credit"
            />{" "}
            {t.carryingTail}
          </>
        ) : (
          t.nobodyCarrying
        )}
      </p>
    </section>
  );
}
