import { es } from "../../../../../../lib/i18n/es";
import type { CurrencyInsightsView } from "../../_components/insightsTypes";
import { MemberBreakdown } from "./MemberBreakdown";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { SpendingEvolution } from "./SpendingEvolution";

const t = es.insights;

export function InsightsDetailSurface({
  block,
  groupId,
  nameOf,
}: {
  block: CurrencyInsightsView;
  groupId: string;
  nameOf: (userId: string) => string;
}) {
  const period = block.byMonth.length > 1
    ? { buckets: block.byMonth, mode: "month" as const }
    : { buckets: block.byDay, mode: "day" as const };
  const prefix = `insights-${block.currency.toLowerCase()}`;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card divide-y divide-border">
      <section className="flex flex-col gap-3 p-4" aria-labelledby={`${prefix}-contributions`}>
        <h3 id={`${prefix}-contributions`} className="text-sm font-semibold text-foreground">
          {t.contributions.title}
        </h3>
        <MemberBreakdown members={block.members} currency={block.currency} nameOf={nameOf} />
      </section>
      <section className="flex flex-col gap-3 p-4" aria-labelledby={`${prefix}-categories`}>
        <h3 id={`${prefix}-categories`} className="text-sm font-semibold text-foreground">
          {t.byCategory}
        </h3>
        <CategoryBreakdown buckets={block.byCategory} currency={block.currency} groupId={groupId} />
      </section>
      <SpendingEvolution
        buckets={period.buckets}
        currency={block.currency}
        mode={period.mode}
        headingId={`${prefix}-evolution`}
      />
    </section>
  );
}
