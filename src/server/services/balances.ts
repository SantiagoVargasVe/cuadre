import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { type Balance, type LedgerEntry, computeBalances } from "../../lib/money/balances";
import { computePairwise, type PairwiseLedger } from "../../lib/money/pairwise";
import { explainSimplifiedPlan, simplify } from "../../lib/money/simplify";
import { requireMembership } from "../auth/membership";
import { db } from "../db/client";
import { expensePayers, expenses, expenseSplits, groups, settlements } from "../db/schema";

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
 * T041's pairwise attribution needs to know which payer/split amounts
 * belong to the *same* expense — unlike `loadLedgerRows`'s flat, already
 * netted-by-member rows, this groups live expense_payers/expense_splits
 * by expense_id first. Two joined queries (never one per expense) plus a
 * third for settlements, which are already flat one-row-per-transfer.
 */
async function loadPairwiseLedger(groupId: string): Promise<PairwiseLedger> {
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

  const byExpense = new Map<string, { currency: string; payers: Map<string, bigint>; splits: Map<string, bigint> }>();
  function forExpense(expenseId: string, currency: string) {
    let entry = byExpense.get(expenseId);
    if (!entry) {
      entry = { currency, payers: new Map(), splits: new Map() };
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
}

export interface BalancesView {
  displayCurrency: string | null;
  byCurrency: CurrencyBalances[];
}

function toPlanEdge(edge: { from: string; to: string; amount: bigint }): PlanEdgeView {
  return { from: edge.from, to: edge.to, amount: edge.amount.toString() };
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

  const [nets, pairwiseLedger] = await Promise.all([computeGroupNet(groupId), loadPairwiseLedger(groupId)]);
  const simplified = options.simplify ?? group!.simplifyDebts;
  const rawDebts = computePairwise(pairwiseLedger);

  const byCurrency: CurrencyBalances[] = [...nets].map(([currency, byMember]) => {
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

    return { currency, members, plan, simplified };
  });

  // displayCurrency is surfaced as-is; collapsing byCurrency into it via
  // FX conversion is T054's job (out of scope here — see the task file).
  return { displayCurrency: group!.displayCurrency, byCurrency };
}
