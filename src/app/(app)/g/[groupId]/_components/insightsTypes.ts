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

/** The one-glance summary card (T084), per currency. All amounts are minor-unit strings. */
export interface LargestExpenseView {
  title: string;
  amount: string;
  currency: string;
  /** Payer display names, sorted. */
  payers: string[];
}
export interface CarryingView {
  userId: string;
  /** The member's positive `currentNet` — how much they're currently fronting. */
  amount: string;
}
export interface SummaryView {
  totalSpent: string;
  expenseCount: number;
  firstExpenseDate: string | null;
  lastExpenseDate: string | null;
  /** `totalSpent / expenseCount`, floored to a minor unit; `"0"` when there are no expenses. */
  averagePerExpense: string;
  largestExpense: LargestExpenseView | null;
  /** `null` when nobody has a positive `currentNet` — an all-settled group. */
  carrying: CarryingView | null;
}

export interface CurrencyInsightsView {
  currency: string;
  summary: SummaryView;
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
