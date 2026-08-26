import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { requireMembership, requireOwner } from "../auth/membership";
import { db } from "../db/client";
import { groupMembers, users } from "../db/schema";
import { NotFoundError, ValidationError } from "../errors";
import { getGroupBalances } from "./balances";

/** The target of a removal isn't a current member — never existed, or already removed. */
export class NotAGroupMemberError extends NotFoundError {
  constructor() {
    super("NOT_A_MEMBER", "That user is not a current member of this group");
    this.name = "NotAGroupMemberError";
  }
}

/** The sole owner tried to remove themselves — the group would be left ownerless. */
export class LastOwnerCannotBeRemovedError extends ValidationError {
  constructor() {
    super("LAST_OWNER", "The only owner cannot be removed from the group");
    this.name = "LastOwnerCannotBeRemovedError";
  }
}

/** The member being removed still has a non-zero net position in at least one currency. */
export class MemberHasOutstandingBalanceError extends ValidationError {
  constructor(balances: { currency: string; net: string }[]) {
    super("MEMBER_HAS_BALANCE", "This member still owes or is owed money in this group", {
      balances,
    });
    this.name = "MemberHasOutstandingBalanceError";
  }
}

export interface MemberSummary {
  userId: string;
  displayName: string;
  role: "owner" | "member";
  joinedAt: string;
}

/** Never emails (security.md § Privacy) — display name and id only, regardless of who's asking. */
export async function listMembers(groupId: string, userId: string): Promise<MemberSummary[]> {
  await requireMembership(groupId, userId);

  const rows = await db
    .select({
      userId: groupMembers.userId,
      displayName: users.displayName,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.removedAt)));

  return rows.map((row) => ({ ...row, joinedAt: row.joinedAt.toISOString() }));
}

async function currentOwnerCount(groupId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.role, "owner"), isNull(groupMembers.removedAt)),
    );
  return row?.count ?? 0;
}

/**
 * Owner only (api-contract.md). Refused with `MemberHasOutstandingBalanceError`
 * while the target's net is non-zero in **any** currency — checked across
 * every currency present, not just the group's display currency, so a
 * member square in COP and owed USD isn't removable. Never hard-deletes:
 * historical expenses reference this row (data-model.md § Deletion
 * semantics).
 */
export async function removeMember(groupId: string, actingUserId: string, targetUserId: string): Promise<void> {
  await requireOwner(groupId, actingUserId);

  const [target] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, targetUserId),
        isNull(groupMembers.removedAt),
      ),
    )
    .limit(1);
  if (!target) throw new NotAGroupMemberError();

  if (targetUserId === actingUserId && target.role === "owner" && (await currentOwnerCount(groupId)) === 1) {
    throw new LastOwnerCannotBeRemovedError();
  }

  const balances = await getGroupBalances(groupId, actingUserId);
  const outstanding = [...balances]
    .map(([currency, byMember]) => ({ currency, net: byMember.get(targetUserId)?.net ?? 0n }))
    .filter(({ net }) => net !== 0n);
  if (outstanding.length > 0) {
    throw new MemberHasOutstandingBalanceError(
      outstanding.map(({ currency, net }) => ({ currency, net: net.toString() })),
    );
  }

  await db
    .update(groupMembers)
    .set({ removedAt: new Date() })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)));
}
