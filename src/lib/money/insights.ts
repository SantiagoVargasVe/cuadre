/**
 * Pure aggregation for the insights charts (T081). No I/O, no `Intl`, no
 * DB — the service loads (and, when a display currency is pinned,
 * converts) the per-expense rows; this only sums them into buckets.
 *
 * **Never sums across currencies.** Input rows carry their own currency
 * and come out as one `CurrencyAggregate` per distinct currency. When the
 * caller has already converted every row into a display currency, that's
 * naturally a single-currency input and so a single aggregate out.
 *
 * A bucket is emitted only when its total is positive: an empty group, or
 * one whose every foreign-currency expense rounds to nothing in the
 * display currency, yields no buckets rather than a zero-height bar.
 */

export interface InsightExpense {
  /** Calendar date `YYYY-MM-DD` (no time, no zone). */
  date: string;
  currency: string;
  /** A fixed category key (T090), or `null` for an uncategorised expense. */
  category: string | null;
  /** The expense total in minor units — already converted if the caller converted. */
  total: bigint;
  /** Resolved per-member split, minor units — already converted if the caller converted. */
  splits: Map<string, bigint>;
}

export interface PeriodBucket {
  /** `YYYY-MM-DD` for a day bucket, `YYYY-MM` for a month bucket. */
  key: string;
  amount: bigint;
}
export interface MemberBucket {
  userId: string;
  amount: bigint;
}
export interface CategoryBucket {
  /** `null` is kept as its own "uncategorised" bucket — never folded into `otro`. */
  category: string | null;
  amount: bigint;
}

export interface CurrencyAggregate {
  currency: string;
  byDay: PeriodBucket[];
  byMonth: PeriodBucket[];
  byMember: MemberBucket[];
  byCategory: CategoryBucket[];
}

function add<K>(map: Map<K, bigint>, key: K, amount: bigint): void {
  map.set(key, (map.get(key) ?? 0n) + amount);
}

function positivePeriods(map: Map<string, bigint>): PeriodBucket[] {
  return [...map]
    .filter(([, amount]) => amount > 0n)
    .map(([key, amount]) => ({ key, amount }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Biggest first; ties broken by the secondary key so two runs never disagree. */
function byAmountDesc<T>(entries: [T, bigint][], tieKey: (value: T) => string): { value: T; amount: bigint }[] {
  return entries
    .filter(([, amount]) => amount > 0n)
    .map(([value, amount]) => ({ value, amount }))
    .sort((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : tieKey(a.value) < tieKey(b.value) ? -1 : 1));
}

export function aggregateInsights(expenses: InsightExpense[]): CurrencyAggregate[] {
  const byCurrency = new Map<string, InsightExpense[]>();
  for (const expense of expenses) {
    const list = byCurrency.get(expense.currency) ?? [];
    list.push(expense);
    byCurrency.set(expense.currency, list);
  }

  return [...byCurrency.keys()]
    .sort()
    .map((currency) => {
      const days = new Map<string, bigint>();
      const months = new Map<string, bigint>();
      const members = new Map<string, bigint>();
      const categories = new Map<string | null, bigint>();

      for (const expense of byCurrency.get(currency)!) {
        add(days, expense.date, expense.total);
        add(months, expense.date.slice(0, 7), expense.total);
        add(categories, expense.category, expense.total);
        for (const [userId, amount] of expense.splits) add(members, userId, amount);
      }

      return {
        currency,
        byDay: positivePeriods(days),
        byMonth: positivePeriods(months),
        byMember: byAmountDesc([...members], (userId) => userId).map(({ value, amount }) => ({
          userId: value,
          amount,
        })),
        // On an amount tie: real keys alphabetically, then the null bucket
        // ("~" sorts after every lowercase category key). Stable, arbitrary.
        byCategory: byAmountDesc([...categories], (key) => key ?? "~").map(({ value, amount }) => ({
          category: value,
          amount,
        })),
      };
    });
}
