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
export interface CategoryBucketView {
  category: string | null;
  amount: string;
}

/** Per-member breakdown row (T082). `expenseContribution` describes the
 * paired bars; `currentNet` is the settlement-aware balance. */
export interface MemberBreakdownView {
  userId: string;
  paid: string;
  consumed: string;
  expenseContribution: string;
  sent: string;
  received: string;
  currentNet: string;
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
  byCategory: CategoryBucketView[];
  members: MemberBreakdownView[];
  pins?: PinView[];
}

export interface InsightsResult {
  displayCurrency: string | null;
  byCurrency: CurrencyInsightsView[];
}
