import "server-only";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { config } from "../config";
import { assertGroupNotArchived, requireMembership } from "../auth/membership";
import { db, withTransaction, type Transaction } from "../db/client";
import { isUniqueViolation } from "../db/pg-errors";
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
 * Atomically marks an invite code consumed, inside the caller's
 * transaction. The conditional UPDATE — rather than a SELECT to check
 * validity followed by an UPDATE — is what makes this race-safe: two
 * concurrent callers both attempting the same code serialize on Postgres's
 * row lock, and whichever commits second finds zero rows matching its own
 * WHERE clause.
 */
export async function consumeInvite(
  tx: Transaction,
  code: string,
  userId: string,
): Promise<{ groupId: string | null }> {
  const [row] = await tx
    .update(inviteCodes)
    .set({ consumedBy: userId, consumedAt: new Date() })
    .where(
      and(
        eq(inviteCodes.code, code),
        isNull(inviteCodes.consumedAt),
        or(isNull(inviteCodes.expiresAt), gt(inviteCodes.expiresAt, new Date())),
      ),
    )
    .returning({ groupId: inviteCodes.groupId });

  if (!row) throw new InvalidInviteError();
  return { groupId: row.groupId };
}

export interface CreateInviteInput {
  expiresAt?: Date;
}

/**
 * Any current member may mint a code — no approval step (api-contract.md).
 * Each code is single-use (ADR-0002's schema), so onboarding several people
 * means minting several codes, one per invitee.
 */
export async function createInvite(
  groupId: string,
  userId: string,
  input: CreateInviteInput,
): Promise<{ code: string; url: string }> {
  await requireMembership(groupId, userId);
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  assertGroupNotArchived(group!);

  const code = nanoid(INVITE_CODE_LENGTH);
  await db.insert(inviteCodes).values({ code, groupId, createdBy: userId, expiresAt: input.expiresAt });

  return { code, url: `${config.APP_URL}/join/${code}` };
}

export type InviteLookup =
  | { valid: true; groupTitle?: string; inviterName: string | null }
  | { valid: false };

/**
 * Unauthenticated — the register/join page needs this before anyone has an
 * account. Returns **only** groupTitle, inviterName, and valid
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
    })
    .from(inviteCodes)
    .leftJoin(users, eq(users.id, inviteCodes.createdBy))
    .leftJoin(groups, eq(groups.id, inviteCodes.groupId))
    .where(eq(inviteCodes.code, code))
    .limit(1);

  if (!row) return { valid: false };
  if (row.consumedAt) return { valid: false };
  if (row.expiresAt && row.expiresAt < new Date()) return { valid: false };

  return { valid: true, groupTitle: row.groupTitle ?? undefined, inviterName: row.inviterName };
}

/**
 * For an **already-registered** user joining via a group invite — the
 * new-account path (register + consume + join in one transaction) is
 * services/auth.ts `register()` instead. Same conditional-update
 * consumption as that path: zero rows means InvalidInviteError (409).
 *
 * If the membership insert then hits the unique constraint (already a
 * member), the whole transaction — including the invite consumption —
 * rolls back, so a code doesn't get burned by someone who gained nothing
 * from it.
 */
export async function acceptInvite(code: string, userId: string): Promise<Group> {
  return withTransaction(async (tx) => {
    const { groupId } = await consumeInvite(tx, code, userId);
    if (!groupId) throw new NotAGroupInviteError();

    try {
      await tx.insert(groupMembers).values({ groupId, userId, role: "member" });
    } catch (error) {
      if (isUniqueViolation(error)) throw new AlreadyAMemberError();
      throw error;
    }

    const [group] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    return group!;
  });
}
