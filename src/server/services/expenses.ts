import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
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
import { liveExpenses } from "../db/helpers";
import {
  expensePayers,
  expenseRevisions,
  expenses,
  expenseSplits,
  groupMembers,
  groups,
  users,
} from "../db/schema";
import { assertSupportedCurrency } from "./currencies";
import { convertAmounts, loadConversionContext, type ConversionContext } from "./fx";
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

export interface ExpensePartyWithName extends ExpenseParty {
  displayName: string;
}

export interface ConvertedAmounts {
  total: { amount: string; currency: string };
  payers: ExpensePartyWithName[];
  splits: ExpensePartyWithName[];
}

export interface EditedBy {
  userId: string;
  displayName: string;
}

export interface ExpenseSummary {
  id: string;
  title: string;
  date: string;
  total: { amount: string; currency: string };
  payers: ExpensePartyWithName[];
  splits: ExpensePartyWithName[];
  strategy: string;
  /** Present only when the group has a display currency different from this expense's own (T054). */
  converted: ConvertedAmounts | null;
  /** `null` for a never-edited expense (`version === 1`) — on the feed row
   * as well as the detail view (T063: "an edited expense shows an
   * 'editado' marker with who and when"). */
  editedAt: string | null;
  editedBy: EditedBy | null;
}

export interface ExpenseDetail extends ExpenseSummary {
  version: number;
}

interface PartyRow {
  expenseId: string;
  userId: string;
  amount: bigint;
  displayName: string;
}

function groupByExpenseId(rows: PartyRow[]): Map<string, ExpensePartyWithName[]> {
  const map = new Map<string, ExpensePartyWithName[]>();
  for (const row of rows) {
    const list = map.get(row.expenseId) ?? [];
    list.push({ userId: row.userId, displayName: row.displayName, amount: row.amount.toString() });
    map.set(row.expenseId, list);
  }
  return map;
}

/**
 * Payers and splits for a page of expense ids in exactly two queries,
 * regardless of how many expenses or how many parties each has — never
 * one query per expense (testing.md, architecture.md § no N+1 per member).
 * Each expense's parties come back ordered by `user_id` so the feed
 * renders them the same way every time — otherwise the order is heap
 * order and flips between runs.
 */
async function loadPartiesFor(
  expenseIds: string[],
): Promise<{ payersByExpense: Map<string, ExpensePartyWithName[]>; splitsByExpense: Map<string, ExpensePartyWithName[]> }> {
  if (expenseIds.length === 0) return { payersByExpense: new Map(), splitsByExpense: new Map() };

  const [payerRows, splitRows] = await Promise.all([
    db
      .select({
        expenseId: expensePayers.expenseId,
        userId: expensePayers.userId,
        amount: expensePayers.amount,
        displayName: users.displayName,
      })
      .from(expensePayers)
      .innerJoin(users, eq(users.id, expensePayers.userId))
      .where(inArray(expensePayers.expenseId, expenseIds))
      .orderBy(asc(expensePayers.userId)),
    db
      .select({
        expenseId: expenseSplits.expenseId,
        userId: expenseSplits.userId,
        amount: expenseSplits.amount,
        displayName: users.displayName,
      })
      .from(expenseSplits)
      .innerJoin(users, eq(users.id, expenseSplits.userId))
      .where(inArray(expenseSplits.expenseId, expenseIds))
      .orderBy(asc(expenseSplits.userId)),
  ]);

  return { payersByExpense: groupByExpenseId(payerRows), splitsByExpense: groupByExpenseId(splitRows) };
}

function toAmountMap(parties: ExpensePartyWithName[]): Map<string, bigint> {
  return new Map(parties.map((party) => [party.userId, BigInt(party.amount)]));
}

function displayNameLookup(parties: ExpensePartyWithName[]): Map<string, string> {
  return new Map(parties.map((party) => [party.userId, party.displayName]));
}

function toNamedParties(amounts: Map<string, bigint>, names: Map<string, string>): ExpensePartyWithName[] {
  return [...amounts].map(([userId, amount]) => ({
    userId,
    amount: amount.toString(),
    displayName: names.get(userId)!,
  }));
}

/**
 * The read-path conversion (T054, splitting.md § 6): converting each
 * expense's total and re-apportioning payers/splits by their original
 * amounts, so the feed can show both without ever risking an
 * independently-converted row that misses the converted total by a unit.
 * `null` when there's no display currency, or this expense is already in
 * it — nothing to add to what `total`/`payers`/`splits` already show.
 */
function convertForFeed(
  expense: typeof expenses.$inferSelect,
  payers: ExpensePartyWithName[],
  splits: ExpensePartyWithName[],
  ctx: ConversionContext | null,
): ConvertedAmounts | null {
  if (!ctx || expense.currency === ctx.displayCurrency) return null;

  const names = displayNameLookup([...payers, ...splits]);
  const converted = convertAmounts(ctx, expense.currency, expense.id, {
    total: expense.totalAmount,
    payers: toAmountMap(payers),
    splits: toAmountMap(splits),
  });

  return {
    total: { amount: converted.total.toString(), currency: converted.currency },
    payers: toNamedParties(converted.payers, names),
    splits: toNamedParties(converted.splits, names),
  };
}

/**
 * Names for whoever last edited any expense on this page, in one query
 * regardless of how many expenses there are (same reasoning as
 * `loadPartiesFor`). A never-edited expense's `updatedBy` is `null` and
 * never reaches this query.
 */
async function loadEditedByNames(
  rows: (typeof expenses.$inferSelect)[],
): Promise<Map<string, string>> {
  const editorIds = [...new Set(rows.filter((row) => row.version > 1 && row.updatedBy).map((row) => row.updatedBy!))];
  if (editorIds.length === 0) return new Map();

  const editors = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(inArray(users.id, editorIds));
  return new Map(editors.map((editor) => [editor.id, editor.displayName]));
}

function toSummary(
  expense: typeof expenses.$inferSelect,
  payers: ExpensePartyWithName[],
  splits: ExpensePartyWithName[],
  ctx: ConversionContext | null,
  editedByNames: Map<string, string>,
): ExpenseSummary {
  const wasEdited = expense.version > 1;
  // `updatedBy` can be null even for an edited expense — its FK is
  // `ON DELETE SET NULL` (schema.ts) — so "when" and "who" are decided
  // independently rather than one gating the other.
  const editorName = expense.updatedBy ? editedByNames.get(expense.updatedBy) : undefined;
  return {
    id: expense.id,
    title: expense.title,
    date: expense.expenseDate,
    total: { amount: expense.totalAmount.toString(), currency: expense.currency },
    payers,
    splits,
    strategy: expense.splitStrategy,
    converted: convertForFeed(expense, payers, splits, ctx),
    editedAt: wasEdited ? expense.updatedAt.toISOString() : null,
    editedBy: editorName ? { userId: expense.updatedBy!, displayName: editorName } : null,
  };
}

const CURSOR_SEPARATOR = "|";

function encodeCursor(date: string, id: string): string {
  return Buffer.from(`${date}${CURSOR_SEPARATOR}${id}`, "utf8").toString("base64url");
}

/** Malformed cursors are treated as "no cursor" — a tampered value isn't worth a 400 here. */
function decodeCursor(cursor: string): { date: string; id: string } | null {
  try {
    const [date, id] = Buffer.from(cursor, "base64url").toString("utf8").split(CURSOR_SEPARATOR);
    return date && id ? { date, id } : null;
  } catch {
    return null;
  }
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function clampLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit) || limit < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(limit, MAX_PAGE_SIZE);
}

export interface ListExpensesOptions {
  cursor?: string;
  limit?: number;
}

export interface ExpenseListResult {
  items: ExpenseSummary[];
  nextCursor: string | null;
}

/** `null` when the group has no display currency set — nothing to convert the feed into. */
async function loadGroupConversionContext(groupId: string): Promise<ConversionContext | null> {
  const [group] = await db.select({ displayCurrency: groups.displayCurrency }).from(groups).where(eq(groups.id, groupId)).limit(1);
  return group?.displayCurrency ? loadConversionContext(groupId, group.displayCurrency) : null;
}

/**
 * The group feed's data (api-contract.md § Expenses). Ordered by
 * `expense_date DESC, id DESC` — the id tiebreak is what keeps pagination
 * stable on a day with several expenses; sorting by date alone would let a
 * page boundary fall inside a tied group and duplicate or drop rows.
 */
export async function listExpenses(
  groupId: string,
  userId: string,
  options: ListExpensesOptions,
): Promise<ExpenseListResult> {
  await requireMembership(groupId, userId);

  const limit = clampLimit(options.limit);
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;

  const conditions = [eq(expenses.groupId, groupId), isNull(expenses.deletedAt)];
  if (cursor) {
    conditions.push(
      sql`(${expenses.expenseDate}, ${expenses.id}) < (${cursor.date}::date, ${cursor.id}::uuid)`,
    );
  }

  const rows = await db
    .select()
    .from(expenses)
    .where(and(...conditions))
    .orderBy(desc(expenses.expenseDate), desc(expenses.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const [{ payersByExpense, splitsByExpense }, ctx, editedByNames] = await Promise.all([
    loadPartiesFor(page.map((row) => row.id)),
    loadGroupConversionContext(groupId),
    loadEditedByNames(page),
  ]);
  const items = page.map((row) =>
    toSummary(row, payersByExpense.get(row.id) ?? [], splitsByExpense.get(row.id) ?? [], ctx, editedByNames),
  );

  const last = page.at(-1);
  const nextCursor = hasMore && last ? encodeCursor(last.expenseDate, last.id) : null;

  return { items, nextCursor };
}

/**
 * The id-addressed case — no group id in the URL, so membership is
 * checked against the row's own group_id (security.md § the trap). A
 * soft-deleted expense reads as not-found, the same as one that never
 * existed; there's no "view a deleted expense" affordance in v1.
 */
export async function getExpense(expenseId: string, userId: string): Promise<ExpenseDetail> {
  const [expense] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), isNull(expenses.deletedAt)))
    .limit(1);
  await requireMembershipForRow(expense, userId);

  const [{ payersByExpense, splitsByExpense }, ctx, editedByNames] = await Promise.all([
    loadPartiesFor([expense!.id]),
    loadGroupConversionContext(expense!.groupId),
    loadEditedByNames([expense!]),
  ]);

  return {
    ...toSummary(
      expense!,
      payersByExpense.get(expense!.id) ?? [],
      splitsByExpense.get(expense!.id) ?? [],
      ctx,
      editedByNames,
    ),
    version: expense!.version,
  };
}

/** The live-ledger shape used only for CSV export (T080). It intentionally
 * does not reuse `ExpenseSummary`: an export preserves entered amounts and
 * must not load display-currency conversion data or fail on an FX pin. */
export interface ExpenseForExport {
  id: string;
  title: string;
  date: string;
  total: { amount: string; currency: string };
  payers: ExpensePartyWithName[];
  splits: ExpensePartyWithName[];
  strategy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Every live expense in the group, **un-paginated** — the read behind the
 * CSV export (T080). Deliberately not `listExpenses` with a huge `limit`:
 * an export that silently stopped at a page boundary would be worse than
 * no export, so this path has no cursor and no limit to get wrong.
 *
 * Reads through the shared `liveExpenses` helper (data-model.md § *Query
 * rules*) rather than filtering `deleted_at` by hand. It then loads all
 * payers and all splits in two bounded queries, rather than a query per
 * expense. CSV is the entered ledger, so it deliberately does not load the
 * display-currency conversion context used by the UI feed.
 *
 * `liveExpenses` orders newest first by date alone; re-sort ascending by
 * date then id so unchanged exports are stable and spreadsheet-friendly.
 */
export async function listAllExpensesForExport(
  groupId: string,
  userId: string,
): Promise<ExpenseForExport[]> {
  await requireMembership(groupId, userId);

  const rows = await liveExpenses(groupId);
  // `expense_date ASC, id ASC` — plain codepoint comparison, not
  // `localeCompare`, so the tiebreak matches Postgres' own `uuid`/`date`
  // ordering exactly and two exports of unchanged data stay byte-identical.
  const ordered = [...rows].sort((a, b) => {
    if (a.expenseDate !== b.expenseDate) return a.expenseDate < b.expenseDate ? -1 : 1;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
  });

  const { payersByExpense, splitsByExpense } = await loadPartiesFor(ordered.map((row) => row.id));

  return ordered.map((row) => ({
    id: row.id,
    title: row.title,
    date: row.expenseDate,
    total: { amount: row.totalAmount.toString(), currency: row.currency },
    payers: payersByExpense.get(row.id) ?? [],
    splits: splitsByExpense.get(row.id) ?? [],
    strategy: row.splitStrategy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}
