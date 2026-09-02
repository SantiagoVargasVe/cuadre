import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { isExpenseCategoryKey } from "../../lib/categories";
import type { Ledger, LedgerEntry } from "../../lib/money/balances";
import { UnbalancedLedgerError } from "../../lib/money/errors";
import {
  aggregateInsights,
  perMemberBreakdown,
  type CurrencyAggregate,
  type MemberBreakdown,
} from "../../lib/money/insights";
import { requireMembership } from "../auth/membership";
import { db } from "../db/client";
import { liveExpenses } from "../db/helpers";
import { expensePayers, expenseSplits, groupMembers, groups, settlements, users } from "../db/schema";
import { convertAmounts, convertSettlementAmount, loadConversionContext, type Pin } from "./fx";

export interface PeriodBucketView {
  key: string;
  amount: string;
}
export interface CategoryBucketView {
  category: string | null;
  amount: string;
}

/** Per-member breakdown row (T082). `expenseContribution` (paired bars) and
 * `currentNet` (settlement-aware, == balances) are never both just "net". */
export interface MemberBreakdownView {
  userId: string;
  paid: string;
  consumed: string;
  expenseContribution: string;
  sent: string;
  received: string;
  currentNet: string;
}

/** The one-glance summary card (T084), per currency. */
export interface LargestExpenseView {
  title: string;
  amount: string;
  currency: string;
  payers: string[];
}
export interface CarryingView {
  userId: string;
  amount: string;
}
export interface SummaryView {
  totalSpent: string;
  expenseCount: number;
  firstExpenseDate: string | null;
  lastExpenseDate: string | null;
  averagePerExpense: string;
  largestExpense: LargestExpenseView | null;
  carrying: CarryingView | null;
}

export interface CurrencyInsightsView {
  currency: string;
  summary: SummaryView;
  byDay: PeriodBucketView[];
  byMonth: PeriodBucketView[];
  byCategory: CategoryBucketView[];
  members: MemberBreakdownView[];
  /** Present only when this block is a display-currency conversion (T054) — what it converted at. */
  pins?: Pin[];
}

export interface InsightsView {
  displayCurrency: string | null;
  byCurrency: CurrencyInsightsView[];
}

interface ExpenseRow {
  id: string;
  title: string;
  date: string;
  currency: string;
  category: string | null;
  total: bigint;
  payers: Map<string, bigint>;
  splits: Map<string, bigint>;
}

interface SettlementRow {
  from: string;
  to: string;
  currency: string;
  amount: bigint;
}

function groupByExpense(rows: { expenseId: string; userId: string; amount: bigint }[]) {
  const byExpense = new Map<string, Map<string, bigint>>();
  for (const row of rows) {
    let members = byExpense.get(row.expenseId);
    if (!members) byExpense.set(row.expenseId, (members = new Map()));
    members.set(row.userId, row.amount);
  }
  return byExpense;
}

async function loadParties(expenseIds: string[]) {
  if (expenseIds.length === 0) {
    return { payers: new Map<string, Map<string, bigint>>(), splits: new Map<string, Map<string, bigint>>() };
  }
  const [payerRows, splitRows] = await Promise.all([
    db
      .select({ expenseId: expensePayers.expenseId, userId: expensePayers.userId, amount: expensePayers.amount })
      .from(expensePayers)
      .where(inArray(expensePayers.expenseId, expenseIds)),
    db
      .select({ expenseId: expenseSplits.expenseId, userId: expenseSplits.userId, amount: expenseSplits.amount })
      .from(expenseSplits)
      .where(inArray(expenseSplits.expenseId, expenseIds)),
  ]);
  return { payers: groupByExpense(payerRows), splits: groupByExpense(splitRows) };
}

/** Reshapes expenses + settlements into `computeBalances`' flat-entry input. */
function toLedger(expenses: ExpenseRow[], settlementRows: SettlementRow[]): Ledger {
  const paid: LedgerEntry[] = [];
  const owed: LedgerEntry[] = [];
  const sent: LedgerEntry[] = [];
  const received: LedgerEntry[] = [];
  for (const expense of expenses) {
    for (const [memberId, amount] of expense.payers) paid.push({ currency: expense.currency, memberId, amount });
    for (const [memberId, amount] of expense.splits) owed.push({ currency: expense.currency, memberId, amount });
  }
  for (const s of settlementRows) {
    sent.push({ currency: s.currency, memberId: s.from, amount: s.amount });
    received.push({ currency: s.currency, memberId: s.to, amount: s.amount });
  }
  return { paid, owed, sent, received };
}

/** The third leg of the balance canary: Σ payer rows must also equal Σ expense totals. */
function assertTotalsMatch(expenses: ExpenseRow[], breakdown: Map<string, MemberBreakdown[]>): void {
  const totals = new Map<string, bigint>();
  for (const expense of expenses) totals.set(expense.currency, (totals.get(expense.currency) ?? 0n) + expense.total);
  for (const [currency, rows] of breakdown) {
    let paid = 0n;
    for (const row of rows) paid += row.paid;
    const expected = totals.get(currency) ?? 0n;
    if (paid !== expected) throw new UnbalancedLedgerError(currency, paid - expected);
  }
}

const zeroRow = (userId: string): MemberBreakdown => ({
  userId,
  paid: 0n,
  consumed: 0n,
  expenseContribution: 0n,
  sent: 0n,
  received: 0n,
  currentNet: 0n,
});

function compareRows(a: MemberBreakdown, b: MemberBreakdown): number {
  if (a.consumed !== b.consumed) return b.consumed > a.consumed ? 1 : -1;
  if (a.paid !== b.paid) return b.paid > a.paid ? 1 : -1;
  return a.userId < b.userId ? -1 : 1;
}

function serializeMembers(rows: MemberBreakdown[], currentMemberIds: string[]): MemberBreakdownView[] {
  const byId = new Map(rows.map((row) => [row.userId, row]));
  // A current member with no activity in this currency renders as an honest
  // zero, not an absent row. A removed member with historical rows is
  // already in `rows` from the ledger and stays visible.
  for (const id of currentMemberIds) if (!byId.has(id)) byId.set(id, zeroRow(id));

  return [...byId.values()].sort(compareRows).map((row) => ({
    userId: row.userId,
    paid: row.paid.toString(),
    consumed: row.consumed.toString(),
    expenseContribution: row.expenseContribution.toString(),
    sent: row.sent.toString(),
    received: row.received.toString(),
    currentNet: row.currentNet.toString(),
  }));
}

const emptyAggregate = (currency: string): CurrencyAggregate => ({
  currency,
  byDay: [],
  byMonth: [],
  byCategory: [],
});

/**
 * The summary card (T084): server-computed, one per currency, no
 * client-side money math. `largestExpense` breaks a total tie by the
 * earliest `expense_date` then the lexicographically lowest id;
 * `carrying` is the member with the largest **positive `currentNet`**
 * (T082 — settlement-aware, so it agrees with balances), tie broken by
 * lowest user id, and `null` when nobody has a positive net.
 */
function summarize(
  expenses: ExpenseRow[],
  breakdownRows: MemberBreakdown[],
  nameOf: (userId: string) => string,
): SummaryView {
  const count = expenses.length;
  let totalSpent = 0n;
  for (const expense of expenses) totalSpent += expense.total;
  const dates = [...expenses.map((e) => e.date)].sort();

  const largest = [...expenses].sort((a, b) =>
    a.total !== b.total ? (a.total > b.total ? -1 : 1) : a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.id < b.id ? -1 : 1,
  )[0];

  const carrying = breakdownRows
    .filter((row) => row.currentNet > 0n)
    .sort((a, b) => (a.currentNet !== b.currentNet ? (a.currentNet > b.currentNet ? -1 : 1) : a.userId < b.userId ? -1 : 1))[0];

  return {
    totalSpent: totalSpent.toString(),
    expenseCount: count,
    firstExpenseDate: dates[0] ?? null,
    lastExpenseDate: dates.at(-1) ?? null,
    averagePerExpense: (count === 0 ? 0n : totalSpent / BigInt(count)).toString(),
    largestExpense: largest
      ? {
          title: largest.title,
          amount: largest.total.toString(),
          currency: largest.currency,
          payers: [...largest.payers.keys()].sort().map(nameOf),
        }
      : null,
    carrying: carrying ? { userId: carrying.userId, amount: carrying.currentNet.toString() } : null,
  };
}

function serialize(
  aggregate: CurrencyAggregate,
  summary: SummaryView,
  members: MemberBreakdownView[],
  pins?: Pin[],
): CurrencyInsightsView {
  const view: CurrencyInsightsView = {
    currency: aggregate.currency,
    summary,
    byDay: aggregate.byDay.map((b) => ({ key: b.key, amount: b.amount.toString() })),
    byMonth: aggregate.byMonth.map((b) => ({ key: b.key, amount: b.amount.toString() })),
    byCategory: aggregate.byCategory.map((b) => ({ category: b.category, amount: b.amount.toString() })),
    members,
  };
  return pins ? { ...view, pins } : view;
}

function assembleView(
  expenses: ExpenseRow[],
  settlementRows: SettlementRow[],
  currentMemberIds: string[],
  nameOf: (userId: string) => string,
  displayCurrency: string | null,
  pins?: Pin[],
): InsightsView {
  const aggregates = aggregateInsights(
    expenses.map((e) => ({ date: e.date, currency: e.currency, category: e.category, total: e.total })),
  );
  const breakdown = perMemberBreakdown(toLedger(expenses, settlementRows));
  assertTotalsMatch(expenses, breakdown);

  const expensesByCurrency = new Map<string, ExpenseRow[]>();
  for (const expense of expenses) {
    const list = expensesByCurrency.get(expense.currency) ?? [];
    list.push(expense);
    expensesByCurrency.set(expense.currency, list);
  }

  const currencies = [...new Set([...aggregates.map((a) => a.currency), ...breakdown.keys()])].sort();
  const byCurrency = currencies
    .map((currency) => {
      const aggregate = aggregates.find((a) => a.currency === currency) ?? emptyAggregate(currency);
      const members = serializeMembers(breakdown.get(currency) ?? [], currentMemberIds);
      const summary = summarize(expensesByCurrency.get(currency) ?? [], breakdown.get(currency) ?? [], nameOf);
      return serialize(aggregate, summary, members, pins);
    })
    // A settlement-only currency nobody currently in the group touched adds nothing.
    .filter((block) => block.members.length > 0 || block.byDay.length > 0);

  return { displayCurrency, byCurrency };
}

/**
 * Server-computed spending aggregates, the per-member breakdown, and the
 * summary card for the Análisis tab (T081, T082, T084). The client renders
 * and never re-aggregates money — same rule as balances. Membership checked
 * in the service, so a non-member and a removed member both get `404`.
 *
 * Period and category buckets come from expense totals; the per-member
 * rows are a read-side reshape of `computeBalances` (paid / consumed /
 * expenseContribution / sent / received / currentNet) with the same
 * `Σ currentNet == 0` canary plus `Σ paid == Σ consumed == Σ totals`; the
 * per-currency `summary` (total, count, span, average, largest expense,
 * carrying member) is derived from the same rows.
 *
 * When a display currency is pinned, every expense is converted with its
 * own id as the re-apportionment seed and every settlement as a single
 * amount (splitting.md § 6), exactly as the balances read path — so the
 * charts and the breakdown agree with the balances tab to the minor unit.
 * `RATE_UNAVAILABLE` for a currency with no pin. Soft-deleted expenses are
 * excluded via `liveExpenses`.
 */
export async function getInsights(groupId: string, userId: string): Promise<InsightsView> {
  await requireMembership(groupId, userId);
  const [[group], expenseRows, memberRows, settlementRows] = await Promise.all([
    db
      .select({ displayCurrency: groups.displayCurrency })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1),
    liveExpenses(groupId),
    db
      .select({ userId: groupMembers.userId, displayName: users.displayName, removedAt: groupMembers.removedAt })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, groupId)),
    db
      .select({
        from: settlements.fromUserId,
        to: settlements.toUserId,
        currency: settlements.currency,
        amount: settlements.amount,
      })
      .from(settlements)
      .where(and(eq(settlements.groupId, groupId), isNull(settlements.deletedAt))),
  ]);
  const parties = await loadParties(expenseRows.map((row) => row.id));
  const currentMemberIds = memberRows.filter((row) => row.removedAt === null).map((row) => row.userId);
  const namesById = new Map(memberRows.map((row) => [row.userId, row.displayName]));
  const nameOf = (id: string) => namesById.get(id) ?? "?";

  const entered: ExpenseRow[] = expenseRows.map((row) => ({
    id: row.id,
    title: row.title,
    date: row.expenseDate,
    currency: row.currency,
    category: isExpenseCategoryKey(row.categoryKey) ? row.categoryKey : null,
    total: row.totalAmount,
    payers: parties.payers.get(row.id) ?? new Map(),
    splits: parties.splits.get(row.id) ?? new Map(),
  }));

  if (!group?.displayCurrency) {
    return assembleView(entered, settlementRows, currentMemberIds, nameOf, null);
  }

  const ctx = await loadConversionContext(groupId, group.displayCurrency);
  const converted: ExpenseRow[] = entered.map((expense) => {
    const amounts = convertAmounts(ctx, expense.currency, expense.id, {
      total: expense.total,
      payers: expense.payers,
      splits: expense.splits,
    });
    return { ...expense, currency: amounts.currency, total: amounts.total, payers: amounts.payers, splits: amounts.splits };
  });
  const convertedSettlements: SettlementRow[] = settlementRows.map((s) => ({
    from: s.from,
    to: s.to,
    ...convertSettlementAmount(ctx, s.currency, s.amount),
  }));

  return assembleView(converted, convertedSettlements, currentMemberIds, nameOf, group.displayCurrency, ctx.pins);
}
