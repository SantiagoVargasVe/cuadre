import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { type Balance, type Ledger, type LedgerEntry, computeBalances } from "../../lib/money/balances";
import {
  computePairwise,
  type PairwiseExpense,
  type PairwiseLedger,
  type PairwiseSettlement,
} from "../../lib/money/pairwise";
import { explainSimplifiedPlan, simplify } from "../../lib/money/simplify";
import { requireMembership } from "../auth/membership";
import { db } from "../db/client";
import { expensePayers, expenses, expenseSplits, groups, settlements } from "../db/schema";
import { convertAmounts, convertSettlementAmount, loadConversionContext, type Pin } from "./fx";

type LedgerRow = {
  kind: "paid" | "owed" | "sent" | "received";
  currency: string;
  member_id: string;
  amount: string;
};

/**
 * One query for the group's live ledger rows (T040's own acceptance
 * criteria), tagged by kind so a single round trip covers expense_payers,
 * expense_splits, and — as of T043 — settlements, rather than adding
 * separate queries per source.
 */
async function loadLedgerRows(groupId: string): Promise<LedgerRow[]> {
  return db.execute<LedgerRow>(sql`
    SELECT 'paid' AS kind, e.currency, ep.user_id AS member_id, ep.amount::text AS amount
    FROM expense_payers ep
    JOIN expenses e ON e.id = ep.expense_id
    WHERE e.group_id = ${groupId} AND e.deleted_at IS NULL
    UNION ALL
    SELECT 'owed' AS kind, e.currency, es.user_id AS member_id, es.amount::text AS amount
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    WHERE e.group_id = ${groupId} AND e.deleted_at IS NULL
    UNION ALL
    SELECT 'sent' AS kind, s.currency, s.from_user_id AS member_id, s.amount::text AS amount
    FROM settlements s
    WHERE s.group_id = ${groupId} AND s.deleted_at IS NULL
    UNION ALL
    SELECT 'received' AS kind, s.currency, s.to_user_id AS member_id, s.amount::text AS amount
    FROM settlements s
    WHERE s.group_id = ${groupId} AND s.deleted_at IS NULL
  `);
}

async function computeGroupNet(groupId: string): Promise<Map<string, Map<string, Balance>>> {
  const rows = await loadLedgerRows(groupId);

  const paid: LedgerEntry[] = [];
  const owed: LedgerEntry[] = [];
  const sent: LedgerEntry[] = [];
  const received: LedgerEntry[] = [];
  const byKind = { paid, owed, sent, received };
  for (const row of rows) {
    const entry = { currency: row.currency, memberId: row.member_id, amount: BigInt(row.amount) };
    byKind[row.kind].push(entry);
  }

  return computeBalances({ paid, owed, sent, received });
}

/**
 * Net position per member, per currency, for a group (splitting.md §4).
 * Pure computation lives in src/lib/money/balances.ts; this only fetches
 * the raw rows and shapes them into that function's Ledger input. No
 * cached balances table — a stored value that can disagree with the
 * ledger is the exact failure this design avoids (architecture.md).
 */
export async function getGroupBalances(
  groupId: string,
  userId: string,
): Promise<Map<string, Map<string, Balance>>> {
  await requireMembership(groupId, userId);
  return computeGroupNet(groupId);
}

/**
 * The same per-expense shape `PairwiseLedger` uses, plus the expense id —
 * needed by T054's conversion step as the re-apportionment seed, but not
 * by `computePairwise`, which only ever sees this through the narrower
 * `PairwiseExpense` type it declares.
 */
interface PairwiseLedgerWithIds {
  expenses: (PairwiseExpense & { id: string })[];
  settlements: PairwiseSettlement[];
}

/**
 * T041's pairwise attribution needs to know which payer/split amounts
 * belong to the *same* expense — unlike `loadLedgerRows`'s flat, already
 * netted-by-member rows, this groups live expense_payers/expense_splits
 * by expense_id first. Two joined queries (never one per expense) plus a
 * third for settlements, which are already flat one-row-per-transfer.
 */
async function loadPairwiseLedger(groupId: string): Promise<PairwiseLedgerWithIds> {
  const liveExpense = and(eq(expenses.groupId, groupId), isNull(expenses.deletedAt));
  const [payerRows, splitRows, settlementRows] = await Promise.all([
    db
      .select({
        expenseId: expensePayers.expenseId,
        currency: expenses.currency,
        userId: expensePayers.userId,
        amount: expensePayers.amount,
      })
      .from(expensePayers)
      .innerJoin(expenses, eq(expenses.id, expensePayers.expenseId))
      .where(liveExpense),
    db
      .select({
        expenseId: expenseSplits.expenseId,
        currency: expenses.currency,
        userId: expenseSplits.userId,
        amount: expenseSplits.amount,
      })
      .from(expenseSplits)
      .innerJoin(expenses, eq(expenses.id, expenseSplits.expenseId))
      .where(liveExpense),
    db
      .select({
        currency: settlements.currency,
        from: settlements.fromUserId,
        to: settlements.toUserId,
        amount: settlements.amount,
      })
      .from(settlements)
      .where(and(eq(settlements.groupId, groupId), isNull(settlements.deletedAt))),
  ]);

  const byExpense = new Map<string, PairwiseExpense & { id: string }>();
  function forExpense(expenseId: string, currency: string) {
    let entry = byExpense.get(expenseId);
    if (!entry) {
      entry = { id: expenseId, currency, payers: new Map(), splits: new Map() };
      byExpense.set(expenseId, entry);
    }
    return entry;
  }
  for (const row of payerRows) forExpense(row.expenseId, row.currency).payers.set(row.userId, row.amount);
  for (const row of splitRows) forExpense(row.expenseId, row.currency).splits.set(row.userId, row.amount);

  return {
    expenses: [...byExpense.values()],
    settlements: settlementRows,
  };
}

export interface BalanceMember {
  userId: string;
  paid: string;
  owed: string;
  net: string;
}

export interface PlanEdgeView {
  from: string;
  to: string;
  amount: string;
  explains?: { from: string; to: string; amount: string }[];
}

export interface CurrencyBalances {
  currency: string;
  members: BalanceMember[];
  plan: PlanEdgeView[];
  simplified: boolean;
  /** Only present when this entry is a display-currency conversion (T054) — what it converted at. */
  pins?: Pin[];
}

export interface BalancesView {
  displayCurrency: string | null;
  byCurrency: CurrencyBalances[];
}

function toPlanEdge(edge: { from: string; to: string; amount: bigint }): PlanEdgeView {
  return { from: edge.from, to: edge.to, amount: edge.amount.toString() };
}

function toCurrencyBalances(
  currency: string,
  byMember: Map<string, Balance>,
  rawDebts: { from: string; to: string; currency: string; amount: bigint }[],
  simplified: boolean,
  pins?: Pin[],
): CurrencyBalances {
  const members = [...byMember].map(([memberId, balance]) => ({
    userId: memberId,
    paid: balance.paid.toString(),
    owed: balance.owed.toString(),
    net: balance.net.toString(),
  }));
  const rawForCurrency = rawDebts.filter((debt) => debt.currency === currency);

  const plan: PlanEdgeView[] = simplified
    ? explainSimplifiedPlan(
        simplify(new Map([...byMember].map(([memberId, balance]) => [memberId, balance.net]))),
        rawForCurrency,
      ).map((edge) => ({ ...toPlanEdge(edge), explains: edge.explains.map(toPlanEdge) }))
    : rawForCurrency.map(toPlanEdge);

  return pins ? { currency, members, plan, simplified, pins } : { currency, members, plan, simplified };
}

function sumValues(map: Map<string, bigint>): bigint {
  let total = 0n;
  for (const value of map.values()) total += value;
  return total;
}

/** Reshapes a (possibly converted) pairwise ledger into `computeBalances()`'s flat-entry input — the same pattern `computeGroupNet` uses for its own SQL-sourced rows. */
function toLedgerEntries(ledger: PairwiseLedger): Ledger {
  const paid: LedgerEntry[] = [];
  const owed: LedgerEntry[] = [];
  const sent: LedgerEntry[] = [];
  const received: LedgerEntry[] = [];
  for (const expense of ledger.expenses) {
    for (const [memberId, amount] of expense.payers) paid.push({ currency: expense.currency, memberId, amount });
    for (const [memberId, amount] of expense.splits) owed.push({ currency: expense.currency, memberId, amount });
  }
  for (const settlement of ledger.settlements) {
    sent.push({ currency: settlement.currency, memberId: settlement.from, amount: settlement.amount });
    received.push({ currency: settlement.currency, memberId: settlement.to, amount: settlement.amount });
  }
  return { paid, owed, sent, received };
}

/**
 * The display-currency branch (T054): converts every expense's total and
 * re-apportions payers/splits, and every settlement's amount, into
 * `displayCurrency` (splitting.md § 6), then computes net and pairwise
 * debts from that converted ledger exactly the way the unconverted path
 * computes them from the raw one — `computeBalances`'s own `Σ net == 0`
 * assertion fires again here, now in the display currency, for free.
 * Always at most one entry, since every currency collapses into the same
 * one; zero entries for a group with no activity at all, same as the
 * unconverted path returns for an empty group.
 */
async function getConvertedBalances(
  groupId: string,
  displayCurrency: string,
  simplified: boolean,
): Promise<CurrencyBalances[]> {
  const [rawLedger, ctx] = await Promise.all([
    loadPairwiseLedger(groupId),
    loadConversionContext(groupId, displayCurrency),
  ]);

  const convertedLedger: PairwiseLedger = {
    expenses: rawLedger.expenses.map((expense) => {
      const total = sumValues(expense.splits);
      const { currency, payers, splits } = convertAmounts(ctx, expense.currency, expense.id, {
        total,
        payers: expense.payers,
        splits: expense.splits,
      });
      return { currency, payers, splits };
    }),
    settlements: rawLedger.settlements.map((settlement) => ({
      ...settlement,
      ...convertSettlementAmount(ctx, settlement.currency, settlement.amount),
    })),
  };

  const nets = computeBalances(toLedgerEntries(convertedLedger));
  const rawDebts = computePairwise(convertedLedger);

  return [...nets].map(([currency, byMember]) => toCurrencyBalances(currency, byMember, rawDebts, simplified, ctx.pins));
}

/**
 * Assembles everything in E5 into the documented response
 * (api-contract.md § Balances) — thin by design, wiring together the pure
 * functions from src/lib/money/ rather than computing anything itself.
 * `Σ net == 0` per currency is asserted inside `computeBalances` (T040),
 * so it fires on this path automatically; nothing here needs to re-check it.
 *
 * `simplify` is a **preview override that never writes** — it only picks
 * which pure function decorates this one response. Defaults to the
 * group's own `simplifyDebts` setting; flipping that for real is a PATCH
 * on the group, not a side effect of a GET.
 */
export async function getBalancesView(
  groupId: string,
  userId: string,
  options: { simplify?: boolean },
): Promise<BalancesView> {
  await requireMembership(groupId, userId);
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  const simplified = options.simplify ?? group!.simplifyDebts;

  if (group!.displayCurrency) {
    const byCurrency = await getConvertedBalances(groupId, group!.displayCurrency, simplified);
    return { displayCurrency: group!.displayCurrency, byCurrency };
  }

  const [nets, pairwiseLedger] = await Promise.all([computeGroupNet(groupId), loadPairwiseLedger(groupId)]);
  const rawDebts = computePairwise(pairwiseLedger);
  const byCurrency: CurrencyBalances[] = [...nets].map(([currency, byMember]) =>
    toCurrencyBalances(currency, byMember, rawDebts, simplified),
  );

  return { displayCurrency: null, byCurrency };
}
