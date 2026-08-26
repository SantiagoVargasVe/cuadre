import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { SplitInput } from "../../lib/schemas/expenses";
import {
  ExactAmountsDoNotBalanceError,
  PercentagesDoNotSumError,
} from "../../lib/money/errors";
import { assertPositive, parseMinorUnits } from "../../lib/money/parse";
import { resolveEqualSplit } from "../../lib/money/strategies/equal";
import { resolveExactSplit } from "../../lib/money/strategies/exact";
import { resolveLoanSplit } from "../../lib/money/strategies/loan";
import { resolvePercentageSplit } from "../../lib/money/strategies/percentage";
import { resolveSharesSplit } from "../../lib/money/strategies/shares";
import {
  assertGroupNotArchived,
  requireMembership,
  requireMembershipForRow,
} from "../auth/membership";
import { db, withTransaction } from "../db/client";
import {
  expensePayers,
  expenseRevisions,
  expenses,
  expenseSplits,
  groupMembers,
  groups,
} from "../db/schema";
import { assertSupportedCurrency } from "./currencies";
import { ValidationError } from "../errors";

export class PayersDoNotBalanceError extends ValidationError {
  constructor(expected: bigint, actual: bigint) {
    super("PAYERS_DO_NOT_BALANCE", `Payers sum to ${actual}, expected ${expected}`, {
      expected: expected.toString(),
      actual: actual.toString(),
      difference: (expected - actual).toString(),
    });
    this.name = "PayersDoNotBalanceError";
  }
}

export class SplitsDoNotBalanceError extends ValidationError {
  constructor(expected: bigint, actual: bigint) {
    super("SPLITS_DO_NOT_BALANCE", `Splits sum to ${actual}, expected ${expected}`, {
      expected: expected.toString(),
      actual: actual.toString(),
      difference: (expected - actual).toString(),
    });
    this.name = "SplitsDoNotBalanceError";
  }
}

export class PercentagesDoNotSumTo10000Error extends ValidationError {
  constructor(sum: bigint) {
    super("PERCENTAGES_DO_NOT_SUM", `Basis points sum to ${sum}, expected 10000`, {
      sum: sum.toString(),
    });
    this.name = "PercentagesDoNotSumTo10000Error";
  }
}

/** A payer or split member named in the request isn't a current member of the group. */
export class NotAGroupMemberOnExpenseError extends ValidationError {
  constructor(userIds: string[]) {
    super("NOT_A_MEMBER", "One or more payers or split members are not in the group", { userIds });
    this.name = "NotAGroupMemberOnExpenseError";
  }
}

function sumValues(map: Map<string, bigint>): bigint {
  let total = 0n;
  for (const value of map.values()) total += value;
  return total;
}

function mapFromRecord(record: Record<string, number>): Map<string, bigint> {
  return new Map(Object.entries(record).map(([id, value]) => [id, BigInt(value)]));
}

async function currentMemberIds(groupId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.removedAt)));
  return rows.map((row) => row.userId);
}

interface ResolvedSplit {
  amounts: Map<string, bigint>;
  weights?: Map<string, bigint>;
}

/**
 * Every strategy resolves through src/lib/money/, using the expense id as
 * the apportionment seed — generated before this is called, not after
 * (splitting.md §3.1's rotation depends on it). The money module's own
 * balance/sum errors are remapped here to this endpoint's documented error
 * codes (api-contract.md); anything else from that module is a genuine
 * "well-formed but domain-invalid" input, so it still becomes a 422 rather
 * than an unhandled 500.
 */
function resolveSplit(
  input: SplitInput,
  currentMembers: string[],
  total: bigint,
  expenseId: string,
): ResolvedSplit {
  try {
    switch (input.strategy) {
      case "equal":
        return { amounts: resolveEqualSplit(input.members ?? currentMembers, total, expenseId) };
      case "equal_subset":
        return { amounts: resolveEqualSplit(input.members, total, expenseId) };
      case "shares": {
        const weights = mapFromRecord(input.weights);
        return { amounts: resolveSharesSplit(weights, total, expenseId), weights };
      }
      case "percentage": {
        const weights = mapFromRecord(input.basisPoints);
        return { amounts: resolvePercentageSplit(weights, total, expenseId), weights };
      }
      case "exact": {
        const amounts = new Map(
          Object.entries(input.amounts).map(([id, amount]) => [id, parseMinorUnits(amount)]),
        );
        return { amounts: resolveExactSplit(amounts, total) };
      }
      case "loan":
        return { amounts: resolveLoanSplit(input.to, total) };
    }
  } catch (error) {
    if (error instanceof ExactAmountsDoNotBalanceError) {
      throw new SplitsDoNotBalanceError(error.expected, error.actual);
    }
    if (error instanceof PercentagesDoNotSumError) {
      throw new PercentagesDoNotSumTo10000Error(error.sum);
    }
    if (error instanceof Error) {
      throw new ValidationError("INVALID_SPLIT", error.message);
    }
    throw error;
  }
}

export interface CreateExpenseInput {
  title: string;
  date: string;
  amount: string;
  currency: string;
  paidBy?: { userId: string; amount: string }[];
  split: SplitInput;
}

export interface ExpenseParty {
  userId: string;
  amount: string;
}

export interface ExpenseResult {
  id: string;
  total: { amount: string; currency: string };
  payers: ExpenseParty[];
  splits: ExpenseParty[];
  strategy: string;
  version: number;
  editedAt: string | null;
}

function toParties(map: Map<string, bigint>): ExpenseParty[] {
  return [...map].map(([userId, amount]) => ({ userId, amount: amount.toString() }));
}

function toResult(
  expense: typeof expenses.$inferSelect,
  payers: Map<string, bigint>,
  splits: Map<string, bigint>,
  editedAt: string | null,
): ExpenseResult {
  return {
    id: expense.id,
    total: { amount: expense.totalAmount.toString(), currency: expense.currency },
    payers: toParties(payers),
    splits: toParties(splits),
    strategy: expense.splitStrategy,
    version: expense.version,
    editedAt,
  };
}

function buildSnapshot(expense: typeof expenses.$inferSelect, payers: Map<string, bigint>, splits: Map<string, bigint>) {
  return {
    title: expense.title,
    expenseDate: expense.expenseDate,
    totalAmount: expense.totalAmount.toString(),
    currency: expense.currency,
    splitStrategy: expense.splitStrategy,
    payers: toParties(payers),
    splits: toParties(splits),
  };
}

interface ResolvedWrite {
  totalAmount: bigint;
  payers: Map<string, bigint>;
  splits: Map<string, bigint>;
  splitWeights?: Map<string, bigint>;
}

/**
 * The client sends intent, the server computes the numbers (backend/CLAUDE.md
 * § Writing an expense) — even for `exact`, where the client supplies
 * amounts, they're validated against the total, never adjusted to fit.
 * `Σ payers == total == Σ splits` is asserted here, before any transaction
 * opens, so a rejection names the exact difference; the deferred
 * constraint trigger (T033) re-validates it again at commit as the last
 * line of defense. Shared by create and update — an edit re-resolves
 * exactly the same way a create does, just against the existing expense's
 * id as the seed instead of a freshly generated one.
 */
async function resolveExpenseWrite(
  groupId: string,
  actingUserId: string,
  input: CreateExpenseInput,
  expenseId: string,
): Promise<ResolvedWrite> {
  assertSupportedCurrency(input.currency);
  const totalAmount = parseMinorUnits(input.amount);
  assertPositive(totalAmount);

  // The common case costs the client nothing: omitting paidBy means "I
  // paid the full amount" (api-contract.md).
  let payers: Map<string, bigint>;
  if (input.paidBy && input.paidBy.length > 0) {
    payers = new Map(input.paidBy.map((payer) => [payer.userId, parseMinorUnits(payer.amount)]));
    for (const amount of payers.values()) assertPositive(amount);
    const payersSum = sumValues(payers);
    if (payersSum !== totalAmount) throw new PayersDoNotBalanceError(totalAmount, payersSum);
  } else {
    payers = new Map([[actingUserId, totalAmount]]);
  }

  const memberIds = await currentMemberIds(groupId);
  const { amounts: splits, weights: splitWeights } = resolveSplit(
    input.split,
    memberIds,
    totalAmount,
    expenseId,
  );

  const memberSet = new Set(memberIds);
  const involved = new Set([...payers.keys(), ...splits.keys()]);
  const nonMembers = [...involved].filter((id) => !memberSet.has(id));
  if (nonMembers.length > 0) throw new NotAGroupMemberOnExpenseError(nonMembers);

  return { totalAmount, payers, splits, splitWeights };
}

export async function createExpense(
  groupId: string,
  userId: string,
  input: CreateExpenseInput,
): Promise<ExpenseResult> {
  await requireMembership(groupId, userId);
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  assertGroupNotArchived(group!);

  // Generated now, not after resolving the split — it's the apportionment seed.
  const expenseId = randomUUID();
  const { totalAmount, payers, splits, splitWeights } = await resolveExpenseWrite(
    groupId,
    userId,
    input,
    expenseId,
  );

  return withTransaction(async (tx) => {
    const [expense] = await tx
      .insert(expenses)
      .values({
        id: expenseId,
        groupId,
        title: input.title,
        expenseDate: input.date,
        totalAmount,
        currency: input.currency,
        splitStrategy: input.split.strategy,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await tx
      .insert(expensePayers)
      .values([...payers].map(([uid, amount]) => ({ expenseId, groupId, userId: uid, amount })));
    await tx.insert(expenseSplits).values(
      [...splits].map(([uid, amount]) => ({
        expenseId,
        groupId,
        userId: uid,
        amount,
        weight: splitWeights?.get(uid),
      })),
    );
    await tx.insert(expenseRevisions).values({
      expenseId,
      version: 1,
      action: "created",
      snapshot: buildSnapshot(expense!, payers, splits),
      changedBy: userId,
    });

    return toResult(expense!, payers, splits, null);
  });
}

/**
 * Replaces the whole expense — payers and splits included — and bumps
 * `version`. There is no partial split patch: resolving a half-updated
 * split against a stale total is a state nobody should have to reason
 * about. Any current member may edit any expense in their group,
 * including one they didn't create — the revision history is what makes
 * that safe, not permissions (security.md § Known accepted risks).
 *
 * The route carries no group id, so this is the id-addressed case
 * security.md calls out as the one that gets forgotten: load the row,
 * read *its* group_id, then check membership against that —
 * requireMembershipForRow does exactly this.
 */
export async function updateExpense(
  expenseId: string,
  userId: string,
  input: CreateExpenseInput,
): Promise<ExpenseResult> {
  const [existing] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  await requireMembershipForRow(existing, userId);
  const [group] = await db.select().from(groups).where(eq(groups.id, existing!.groupId)).limit(1);
  assertGroupNotArchived(group!);

  // Same expense id as the seed — an unrelated edit (e.g. just the title)
  // must not reshuffle which member absorbed the remainder (splitting.md §3.1).
  const { totalAmount, payers, splits, splitWeights } = await resolveExpenseWrite(
    existing!.groupId,
    userId,
    input,
    expenseId,
  );

  return withTransaction(async (tx) => {
    const version = existing!.version + 1;
    const [updated] = await tx
      .update(expenses)
      .set({
        title: input.title,
        expenseDate: input.date,
        totalAmount,
        currency: input.currency,
        splitStrategy: input.split.strategy,
        updatedBy: userId,
        version,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId))
      .returning();

    // No partial split patch — replace both child sets entirely.
    await tx.delete(expensePayers).where(eq(expensePayers.expenseId, expenseId));
    await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
    await tx.insert(expensePayers).values(
      [...payers].map(([uid, amount]) => ({
        expenseId,
        groupId: existing!.groupId,
        userId: uid,
        amount,
      })),
    );
    await tx.insert(expenseSplits).values(
      [...splits].map(([uid, amount]) => ({
        expenseId,
        groupId: existing!.groupId,
        userId: uid,
        amount,
        weight: splitWeights?.get(uid),
      })),
    );
    await tx.insert(expenseRevisions).values({
      expenseId,
      version,
      action: "updated",
      snapshot: buildSnapshot(updated!, payers, splits),
      changedBy: userId,
    });

    return toResult(updated!, payers, splits, updated!.updatedAt.toISOString());
  });
}

function toMap(rows: { userId: string; amount: bigint }[]): Map<string, bigint> {
  return new Map(rows.map((row) => [row.userId, row.amount]));
}

/**
 * Soft delete: sets `deleted_at` and writes a `deleted` revision. Nothing
 * is hard-deleted — the payer/split rows survive so the revision snapshot
 * (and any later history view) can still show what the ledger said.
 * `liveExpenses` (T033) is what makes this vanish from balances.
 */
export async function deleteExpense(expenseId: string, userId: string): Promise<void> {
  const [existing] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  await requireMembershipForRow(existing, userId);
  const [group] = await db.select().from(groups).where(eq(groups.id, existing!.groupId)).limit(1);
  assertGroupNotArchived(group!);

  const [payerRows, splitRows] = await Promise.all([
    db.select().from(expensePayers).where(eq(expensePayers.expenseId, expenseId)),
    db.select().from(expenseSplits).where(eq(expenseSplits.expenseId, expenseId)),
  ]);

  await withTransaction(async (tx) => {
    const version = existing!.version + 1;
    const [updated] = await tx
      .update(expenses)
      .set({ deletedAt: new Date(), updatedBy: userId, updatedAt: new Date(), version })
      .where(eq(expenses.id, expenseId))
      .returning();

    await tx.insert(expenseRevisions).values({
      expenseId,
      version,
      action: "deleted",
      snapshot: buildSnapshot(updated!, toMap(payerRows), toMap(splitRows)),
      changedBy: userId,
    });
  });
}
