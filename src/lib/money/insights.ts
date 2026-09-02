import { computeBalances, type Ledger } from "./balances";
import { UnbalancedLedgerError } from "./errors";

/**
 * Pure aggregation for the insights tab (T081, T082). No I/O, no `Intl`,
 * no DB — the service loads (and, when a display currency is pinned,
 * converts) the rows; this only sums them.
 *
 * **Never sums across currencies.** Inputs carry their own currency and
 * come out as one entry per distinct currency. When the caller has
 * already converted every row into a display currency, that's naturally a
 * single-currency input and so a single entry out.
 */

export interface InsightExpense {
  /** Calendar date `YYYY-MM-DD` (no time, no zone). */
  date: string;
  currency: string;
  /** A fixed category key (T090), or `null` for an uncategorised expense. */
  category: string | null;
  /** The expense total in minor units — already converted if the caller converted. */
  total: bigint;
}

export interface PeriodBucket {
  /** `YYYY-MM-DD` for a day bucket, `YYYY-MM` for a month bucket. */
  key: string;
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
  byCategory: CategoryBucket[];
}

function add<K>(map: Map<K, bigint>, key: K, amount: bigint): void {
  map.set(key, (map.get(key) ?? 0n) + amount);
}

/** A bucket is emitted only when its total is positive — no zero-height bars. */
function positivePeriods(map: Map<string, bigint>): PeriodBucket[] {
  return [...map]
    .filter(([, amount]) => amount > 0n)
    .map(([key, amount]) => ({ key, amount }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
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
      const categories = new Map<string | null, bigint>();

      for (const expense of byCurrency.get(currency)!) {
        add(days, expense.date, expense.total);
        add(months, expense.date.slice(0, 7), expense.total);
        add(categories, expense.category, expense.total);
      }

      return {
        currency,
        byDay: positivePeriods(days),
        byMonth: positivePeriods(months),
        // On an amount tie: real keys alphabetically, then the null bucket
        // ("~" sorts after every lowercase category key). Stable, arbitrary.
        byCategory: [...categories]
          .filter(([, amount]) => amount > 0n)
          .sort((a, b) =>
            a[1] !== b[1] ? (a[1] > b[1] ? -1 : 1) : (a[0] ?? "~") < (b[0] ?? "~") ? -1 : 1,
          )
          .map(([category, amount]) => ({ category, amount })),
      };
    });
}

// ── Per-member breakdown (T082) ────────────────────────────────────────

export interface MemberBreakdown {
  userId: string;
  /** Σ live `expense_payers` rows. */
  paid: bigint;
  /** Σ live `expense_splits` rows. */
  consumed: bigint;
  /** `paid − consumed` — the expense-side contribution the paired bars describe. */
  expenseContribution: bigint;
  /** Σ live settlement `from` rows. */
  sent: bigint;
  /** Σ live settlement `to` rows. */
  received: bigint;
  /** `expenseContribution + sent − received` — equals the balances endpoint's `net` exactly. */
  currentNet: bigint;
}

/**
 * Per-member paid / consumed / net, per currency (T082) — a **read-side
 * reshape of `computeBalances`, not a second math path**. `computeBalances`
 * already throws unless `Σ currentNet == 0` per currency; this additionally
 * asserts `Σ paid == Σ consumed` per currency (the third leg, `== Σ expense
 * totals`, is checked by the caller, which has the totals). If the view
 * ever disagrees with the balance engine, the view is wrong.
 */
export function perMemberBreakdown(ledger: Ledger): Map<string, MemberBreakdown[]> {
  const byCurrency = computeBalances(ledger);
  const out = new Map<string, MemberBreakdown[]>();

  for (const [currency, byMember] of byCurrency) {
    let totalPaid = 0n;
    let totalConsumed = 0n;
    const rows: MemberBreakdown[] = [];
    for (const [userId, balance] of byMember) {
      totalPaid += balance.paid;
      totalConsumed += balance.owed;
      rows.push({
        userId,
        paid: balance.paid,
        consumed: balance.owed,
        expenseContribution: balance.paid - balance.owed,
        sent: balance.sent,
        received: balance.received,
        currentNet: balance.net,
      });
    }
    if (totalPaid !== totalConsumed) {
      throw new UnbalancedLedgerError(currency, totalPaid - totalConsumed);
    }
    out.set(currency, rows);
  }

  return out;
}
