import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { assertPositive, parseMinorUnits } from "../../lib/money/parse";
import { assertGroupNotArchived, requireMembership, requireMembershipForRow } from "../auth/membership";
import { db } from "../db/client";
import { groupMembers, groups, settlements } from "../db/schema";
import { ValidationError } from "../errors";
import { assertSupportedCurrency } from "./currencies";

/** `toUserId` isn't a current member of the group the settlement is being recorded in. */
export class NotAGroupMemberOnSettlementError extends ValidationError {
  constructor(userId: string) {
    super("NOT_A_MEMBER", "toUserId is not a current member of this group", { userId });
    this.name = "NotAGroupMemberOnSettlementError";
  }
}

/** `fromUserId === toUserId` — paying yourself isn't a settlement. */
export class SettlementRequiresDistinctPartiesError extends ValidationError {
  constructor() {
    super("SETTLEMENT_SAME_PARTY", "A settlement must be between two different members");
    this.name = "SettlementRequiresDistinctPartiesError";
  }
}

export interface SettlementInput {
  toUserId: string;
  amount: string;
  currency: string;
  settledOn: string;
  note?: string;
}

export interface SettlementResult {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: string;
  currency: string;
  settledOn: string;
  note: string | null;
}

function toResult(row: typeof settlements.$inferSelect): SettlementResult {
  return {
    id: row.id,
    fromUserId: row.fromUserId,
    toUserId: row.toUserId,
    amount: row.amount.toString(),
    currency: row.currency,
    settledOn: row.settledOn,
    note: row.note,
  };
}

async function isCurrentMember(groupId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId), isNull(groupMembers.removedAt)))
    .limit(1);
  return !!row;
}

/**
 * Shared by create and update: validates the input against the group's
 * *current* membership and rejects a same-party settlement before any
 * write is attempted, rather than surfacing it as a raw constraint
 * violation. `fromUserId` is checked by the caller (always the acting
 * user for create; left untouched, and therefore already valid, for
 * update) — this only ever needs to check the *new* `toUserId`.
 */
async function assertValidParty(groupId: string, fromUserId: string, toUserId: string): Promise<void> {
  if (fromUserId === toUserId) throw new SettlementRequiresDistinctPartiesError();
  if (!(await isCurrentMember(groupId, toUserId))) {
    throw new NotAGroupMemberOnSettlementError(toUserId);
  }
}

/**
 * `fromUserId` is always the authenticated user (ADR-0009) — recording a
 * payment on someone else's behalf is not in v1, so it's not even a field
 * on the input. Over- and under-payment relative to any suggested plan
 * edge are both normal; nothing here validates the amount against one.
 */
export async function createSettlement(
  groupId: string,
  userId: string,
  input: SettlementInput,
): Promise<SettlementResult> {
  await requireMembership(groupId, userId);
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  assertGroupNotArchived(group!);

  assertSupportedCurrency(input.currency);
  const amount = parseMinorUnits(input.amount);
  assertPositive(amount);
  await assertValidParty(groupId, userId, input.toUserId);

  const [row] = await db
    .insert(settlements)
    .values({
      groupId,
      fromUserId: userId,
      toUserId: input.toUserId,
      amount,
      currency: input.currency,
      settledOn: input.settledOn,
      note: input.note ?? null,
      createdBy: userId,
    })
    .returning();

  return toResult(row!);
}

/**
 * Replaces the whole settlement except `fromUserId`, which never changes —
 * there's no field for it on the input, the same way there's no way to
 * reassign who paid for an expense after the fact. Any current member of
 * the group may edit any settlement in it (same permission model as
 * expenses — security.md's "friction against the actual failure mode").
 *
 * No group id in the URL, so membership is checked against the row's own
 * `group_id` (security.md § the trap) — requireMembershipForRow does this.
 */
export async function updateSettlement(
  settlementId: string,
  userId: string,
  input: SettlementInput,
): Promise<SettlementResult> {
  const [existing] = await db.select().from(settlements).where(eq(settlements.id, settlementId)).limit(1);
  const { row } = await requireMembershipForRow(existing, userId);
  const [group] = await db.select().from(groups).where(eq(groups.id, row.groupId)).limit(1);
  assertGroupNotArchived(group!);

  assertSupportedCurrency(input.currency);
  const amount = parseMinorUnits(input.amount);
  assertPositive(amount);
  await assertValidParty(row.groupId, row.fromUserId, input.toUserId);

  const [updated] = await db
    .update(settlements)
    .set({
      toUserId: input.toUserId,
      amount,
      currency: input.currency,
      settledOn: input.settledOn,
      // `?? null`, not the raw (possibly undefined) input: drizzle's
      // `.set()` silently *skips* a key whose value is `undefined` rather
      // than clearing the column, which would quietly break the "PATCH
      // replaces the whole settlement" contract for a request that omits
      // `note` to clear it.
      note: input.note ?? null,
      updatedAt: new Date(),
    })
    .where(eq(settlements.id, settlementId))
    .returning();

  return toResult(updated!);
}

/** Soft delete — sets `deleted_at`. Excluded from balances the moment this commits. */
export async function deleteSettlement(settlementId: string, userId: string): Promise<void> {
  const [existing] = await db.select().from(settlements).where(eq(settlements.id, settlementId)).limit(1);
  const { row } = await requireMembershipForRow(existing, userId);
  const [group] = await db.select().from(groups).where(eq(groups.id, row.groupId)).limit(1);
  assertGroupNotArchived(group!);

  await db
    .update(settlements)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(settlements.id, settlementId));
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

export interface ListSettlementsOptions {
  cursor?: string;
  limit?: number;
}

export interface SettlementListResult {
  items: SettlementResult[];
  nextCursor: string | null;
}

/**
 * Paginated the same way as the expense feed (api-contract.md §
 * Conventions): `settled_on DESC, id DESC`, the id tiebreak keeping
 * pagination stable across a day with several settlements.
 */
export async function listSettlements(
  groupId: string,
  userId: string,
  options: ListSettlementsOptions,
): Promise<SettlementListResult> {
  await requireMembership(groupId, userId);

  const limit = clampLimit(options.limit);
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;

  const conditions = [eq(settlements.groupId, groupId), isNull(settlements.deletedAt)];
  if (cursor) {
    conditions.push(
      sql`(${settlements.settledOn}, ${settlements.id}) < (${cursor.date}::date, ${cursor.id}::uuid)`,
    );
  }

  const rows = await db
    .select()
    .from(settlements)
    .where(and(...conditions))
    .orderBy(desc(settlements.settledOn), desc(settlements.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items = page.map(toResult);

  const last = page.at(-1);
  const nextCursor = hasMore && last ? encodeCursor(last.settledOn, last.id) : null;

  return { items, nextCursor };
}
