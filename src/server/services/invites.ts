import "server-only";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { config } from "../config";
import { assertGroupNotArchived, requireMembership } from "../auth/membership";
import { db, withTransaction, type Transaction } from "../db/client";
import { groupMembers, groups, inviteCodes, users } from "../db/schema";
import { ConflictError, ValidationError } from "../errors";
import type { Group } from "./groups";

/** Expired, already-consumed, and never-existed codes are deliberately indistinguishable (security.md). */
export class InvalidInviteError extends ConflictError {
  constructor() {
    super("INVALID_INVITE_CODE", "Invite code is invalid, expired, or already used");
    this.name = "InvalidInviteError";
  }
}

/** A registration-only invite (no group_id) was posted to the group-accept endpoint. */
export class NotAGroupInviteError extends ValidationError {
  constructor() {
    super("INVITE_HAS_NO_GROUP", "This invite code doesn't carry a group to join");
    this.name = "NotAGroupInviteError";
  }
}

/** The invite consumed cleanly, but the acting user is already a member of its group. */
export class AlreadyAMemberError extends ConflictError {
  constructor() {
    super("ALREADY_A_MEMBER", "You're already a member of this group");
    this.name = "AlreadyAMemberError";
  }
}

const INVITE_CODE_LENGTH = 16;

/**
 * Validates an invite inside the caller's account/membership transaction.
 * Legacy codes record one consumer atomically; reusable group links keep
 * their consumer fields null (ADR-0014). Both serialize on the row lock.
 */
export async function consumeInvite(
  tx: Transaction,
  code: string,
  userId: string,
): Promise<{ groupId: string | null }> {
  const [row] = await tx
    .update(inviteCodes)
    .set({
      consumedBy: sql`CASE WHEN ${inviteCodes.reusable} THEN NULL ELSE ${userId}::uuid END`,
      consumedAt: sql`CASE WHEN ${inviteCodes.reusable} THEN NULL ELSE ${new Date().toISOString()}::timestamptz END`,
    })
    .where(
      and(
        eq(inviteCodes.code, code),
        isNull(inviteCodes.consumedAt),
        or(isNull(inviteCodes.expiresAt), gt(inviteCodes.expiresAt, new Date())),
        or(isNull(inviteCodes.groupId), sql`EXISTS (
          SELECT 1 FROM ${groups} WHERE ${groups.id} = ${inviteCodes.groupId}
          AND ${groups.archivedAt} IS NULL
        )`),
      ),
    )
    .returning({ groupId: inviteCodes.groupId, expiresAt: inviteCodes.expiresAt });

  // A request may have waited for another join's row lock past expiry.
  if (!row || (row.expiresAt && row.expiresAt <= new Date())) throw new InvalidInviteError();
  return { groupId: row.groupId };
}

/**
 * Any current member may mint a code — no approval step (api-contract.md).
 * New group codes are reusable for exactly 24 hours (ADR-0014).
 */
export async function createInvite(
  groupId: string,
  userId: string,
): Promise<{ code: string; url: string; expiresAt: string }> {
  await requireMembership(groupId, userId);
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  assertGroupNotArchived(group!);

  const code = nanoid(INVITE_CODE_LENGTH);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
  await db.insert(inviteCodes).values({ code, groupId, createdBy: userId, reusable: true, createdAt, expiresAt });

  return { code, url: `${config.APP_URL}/join/${code}`, expiresAt: expiresAt.toISOString() };
}

export type InviteLookup =
  | { valid: true; groupTitle?: string; inviterName: string | null; expiresAt?: string }
  | { valid: false };

/**
 * Unauthenticated — the register/join page needs this before anyone has an
 * account. Returns **only** groupTitle, inviterName, validity and expiry
 * (security.md § Invite codes): no member list, no expense count, no ids,
 * no email addresses. `inviterName` is null only for the bootstrap code
 * `seed:invite` mints with no creator, before any user exists.
 */
export async function lookupInvite(code: string): Promise<InviteLookup> {
  const [row] = await db
    .select({
      expiresAt: inviteCodes.expiresAt,
      consumedAt: inviteCodes.consumedAt,
      inviterName: users.displayName,
      groupTitle: groups.title,
      archivedAt: groups.archivedAt,
    })
    .from(inviteCodes)
    .leftJoin(users, eq(users.id, inviteCodes.createdBy))
    .leftJoin(groups, eq(groups.id, inviteCodes.groupId))
    .where(eq(inviteCodes.code, code))
    .limit(1);

  if (!row) return { valid: false };
  if (row.consumedAt) return { valid: false };
  if (row.archivedAt) return { valid: false };
  if (row.expiresAt && row.expiresAt <= new Date()) return { valid: false };

  return {
    valid: true, groupTitle: row.groupTitle ?? undefined, inviterName: row.inviterName,
    ...(row.expiresAt ? { expiresAt: row.expiresAt.toISOString() } : {}),
  };
}

/**
 * For an **already-registered** user joining via a group invite — the
 * new-account path (register + consume + join in one transaction) is
 * services/auth.ts `register()` instead. Same conditional-update
 * validation as that path: zero rows means InvalidInviteError (409).
 *
 * The composite pk on `group_members` means a returning member (one this
 * group previously removed) hits the same row a fresh join would insert —
 * so this **reactivates** it (`removed_at` cleared, a fresh `joined_at`,
 * back to plain `member` even if they were `owner` before) rather than
 * failing, via `ON CONFLICT ... DO UPDATE ... WHERE removed_at IS NOT
 * NULL` (T024). A conflict against a row that's still *active* leaves that
 * `WHERE` unmatched — Postgres does nothing, `RETURNING` yields no row,
 * and that's the real "already a member" case. Either way, hitting
 * `AlreadyAMemberError` rolls back the whole transaction — including the
 * invite consumption — so a code doesn't get burned by someone who gained
 * nothing from it.
 */
export async function acceptInvite(code: string, userId: string): Promise<Group> {
  return withTransaction(async (tx) => {
    const { groupId } = await consumeInvite(tx, code, userId);
    if (!groupId) throw new NotAGroupInviteError();

    const [membership] = await tx
      .insert(groupMembers)
      .values({ groupId, userId, role: "member" })
      .onConflictDoUpdate({
        target: [groupMembers.groupId, groupMembers.userId],
        set: { removedAt: null, role: "member", joinedAt: new Date() },
        setWhere: sql`${groupMembers.removedAt} IS NOT NULL`,
      })
      .returning();
    if (!membership) throw new AlreadyAMemberError();

    const [group] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    return group!;
  });
}
