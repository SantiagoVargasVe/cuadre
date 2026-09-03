import { es } from "../../../../../../lib/i18n/es";
import { HiddenDataTable } from "../../../../../_ui/charts/HiddenDataTable";
import { PairedBars } from "../../../../../_ui/charts/PairedBars";
import { memberBreakdownData } from "../../_components/insightsBars";
import type { MemberBreakdownView } from "../../_components/insightsTypes";

const t = es.insights;

/**
 * Per member: what they **paid for** vs. what they **consumed** as paired
 * bars on one scale (T082), and their **current balance** — which, unlike
 * the bars, folds in payments already recorded, so the two numbers are
 * labelled distinctly and never both called "net". Uses `--credit` /
 * `--debit` / `--settled` for the balance (never `--destructive`), always
 * with a word alongside the amount.
 */
export function MemberBreakdown({
  members,
  currency,
  nameOf,
}: {
  members: MemberBreakdownView[];
  currency: string;
  nameOf: (userId: string) => string;
}) {
  if (members.length === 0) return null;
  const data = memberBreakdownData(members, currency, nameOf);

  return (
    <div className="flex flex-col gap-3">
      <PairedBars
        title={t.breakdown.title}
        description={t.breakdown.chartDescription}
        aLabel={t.breakdown.paid}
        bLabel={t.breakdown.consumed}
        rows={data.pairedRows}
      />
      <HiddenDataTable
        caption={t.breakdown.title}
        columnLabels={[t.memberColumn, t.breakdown.paid, t.breakdown.consumed, t.breakdown.currentNet]}
        rows={data.tableRows}
      />
      <p className="text-xs text-muted-foreground">{t.breakdown.netNote}</p>
    </div>
  );
}
