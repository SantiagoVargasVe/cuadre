import "server-only";
import { eq, inArray } from "drizzle-orm";
import { isExpenseCategoryKey } from "../../lib/categories";
import {
  aggregateInsights,
  type CurrencyAggregate,
  type InsightExpense,
} from "../../lib/money/insights";
import { requireMembership } from "../auth/membership";
import { db } from "../db/client";
import { liveExpenses } from "../db/helpers";
import { expenseSplits, groups } from "../db/schema";
import { convertAmounts, loadConversionContext, type Pin } from "./fx";

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

export interface CurrencyInsightsView {
  currency: string;
  byDay: PeriodBucketView[];
  byMonth: PeriodBucketView[];
  byMember: MemberBucketView[];
  byCategory: CategoryBucketView[];
  /** Present only when this block is a display-currency conversion (T054) — what it converted at. */
  pins?: Pin[];
}

export interface InsightsView {
  displayCurrency: string | null;
  byCurrency: CurrencyInsightsView[];
}

function serialize(aggregate: CurrencyAggregate, pins?: Pin[]): CurrencyInsightsView {
  const periods = (buckets: { key: string; amount: bigint }[]): PeriodBucketView[] =>
    buckets.map((bucket) => ({ key: bucket.key, amount: bucket.amount.toString() }));
  const view: CurrencyInsightsView = {
    currency: aggregate.currency,
    byDay: periods(aggregate.byDay),
    byMonth: periods(aggregate.byMonth),
    byMember: aggregate.byMember.map((bucket) => ({ userId: bucket.userId, amount: bucket.amount.toString() })),
    byCategory: aggregate.byCategory.map((bucket) => ({
      category: bucket.category,
      amount: bucket.amount.toString(),
    })),
  };
  return pins ? { ...view, pins } : view;
}

async function splitsByExpense(expenseIds: string[]): Promise<Map<string, Map<string, bigint>>> {
  const byExpense = new Map<string, Map<string, bigint>>();
  if (expenseIds.length === 0) return byExpense;
  const rows = await db
    .select({ expenseId: expenseSplits.expenseId, userId: expenseSplits.userId, amount: expenseSplits.amount })
    .from(expenseSplits)
    .where(inArray(expenseSplits.expenseId, expenseIds));
  for (const row of rows) {
    let members = byExpense.get(row.expenseId);
    if (!members) {
      members = new Map();
      byExpense.set(row.expenseId, members);
    }
    members.set(row.userId, row.amount);
  }
  return byExpense;
}

/**
 * Server-computed spending aggregates for the insights charts (T081) — by
 * period, by member, and by category, **never summed across currencies**.
 * The client renders these and never re-aggregates money itself, the same
 * rule as balances.
 *
 * When the group has a display currency, each expense is converted with
 * its own id as the re-apportionment seed (splitting.md § 6) exactly as
 * the balances read path does, so the charts agree with the balances tab
 * to the minor unit, and the block carries its pins so the UI can label
 * the figures as converted. A currency present with no pin is
 * `RATE_UNAVAILABLE`, not a silently-unconverted block.
 *
 * Settlements are not spending and never appear here; soft-deleted
 * expenses are excluded via `liveExpenses`.
 */
export async function getInsights(groupId: string, userId: string): Promise<InsightsView> {
  await requireMembership(groupId, userId);
  const [group] = await db
    .select({ displayCurrency: groups.displayCurrency })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  const rows = await liveExpenses(groupId);
  const splits = await splitsByExpense(rows.map((row) => row.id));

  const entered: InsightExpense[] = rows.map((row) => ({
    date: row.expenseDate,
    currency: row.currency,
    category: isExpenseCategoryKey(row.categoryKey) ? row.categoryKey : null,
    total: row.totalAmount,
    splits: splits.get(row.id) ?? new Map(),
  }));

  if (!group?.displayCurrency) {
    return { displayCurrency: null, byCurrency: aggregateInsights(entered).map((aggregate) => serialize(aggregate)) };
  }

  const ctx = await loadConversionContext(groupId, group.displayCurrency);
  const converted: InsightExpense[] = rows.map((row, index) => {
    // `convertAmounts` re-apportions payers too and rejects an empty payer
    // map; insights never reads payers, so pass the splits in that slot and
    // ignore the result. `total` and the re-apportioned `splits` — seeded
    // by the expense id, exactly as the balances read path — are what we use.
    const splits = entered[index]!.splits;
    const amounts = convertAmounts(ctx, row.currency, row.id, {
      total: row.totalAmount,
      payers: splits,
      splits,
    });
    return {
      date: row.expenseDate,
      currency: amounts.currency,
      category: entered[index]!.category,
      total: amounts.total,
      splits: amounts.splits,
    };
  });

  return {
    displayCurrency: group.displayCurrency,
    byCurrency: aggregateInsights(converted).map((aggregate) => serialize(aggregate, ctx.pins)),
  };
}
