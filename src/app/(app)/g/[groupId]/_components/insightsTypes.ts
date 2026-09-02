/**
 * Mirrors `InsightsView` and friends (server/services/insights.ts) — the
 * wire shape from `GET /api/groups/:id/insights` (api-contract.md §
 * *Insights*). Declared here, not imported: `src/app/` never imports from
 * `src/server/` (frontend/CLAUDE.md § *The hard rule*).
 */
export interface PeriodBucketView {
  key: string;
  amount: string;
}
export interface MemberBucketView {
  userId: string;
  amount: string;
}
export interface CategoryBucketView {
  category: string | null;
  amount: string;
}

export interface PinView {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  asOf: string;
  source: string;
}

export interface CurrencyInsightsView {
  currency: string;
  byDay: PeriodBucketView[];
  byMonth: PeriodBucketView[];
  byMember: MemberBucketView[];
  byCategory: CategoryBucketView[];
  pins?: PinView[];
}

export interface InsightsResult {
  displayCurrency: string | null;
  byCurrency: CurrencyInsightsView[];
}
