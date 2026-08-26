import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { groupMembers } from "../db/schema";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";

/**
 * This app's entire authorization model (security.md § Membership is the
 * authorization model). **Call these inside services, never in route
 * handlers** — every group-scoped service takes the acting `userId` and
 * verifies membership itself, on reads as well as writes, so the check
 * can never be skipped by a route that forgets to call a middleware.
 */

/** Not a member: never existed, or `removed_at` is set. Deliberately the same 404 either way. */
export class NotAMemberError extends NotFoundError {
  constructor() {
    super("NOT_A_MEMBER", "Group not found");
    this.name = "NotAMemberError";
  }
}

/** A member, but the action requires `owner`. */
export class NotGroupOwnerError extends ForbiddenError {
  constructor() {
    super("NOT_GROUP_OWNER", "Only the group owner can do this");
    this.name = "NotGroupOwnerError";
  }
}

/** A group's `archived_at` is set. Reads still work; writes must check this explicitly. */
export class GroupArchivedError extends ValidationError {
  constructor() {
    super("GROUP_ARCHIVED", "This group is archived and read-only");
    this.name = "GroupArchivedError";
  }
}

export type GroupMembership = typeof groupMembers.$inferSelect;

/**
 * Throws `NotAMemberError` (404) unless `userId` currently belongs to
 * `groupId`. **Non-membership is 404, not 403** — groups are private and
 * their ids are unguessable, so there's no reason to confirm one exists to
 * an outsider (api-contract.md). A `removed_at` row is not a member: a
 * removed member loses access immediately, even though the row itself
 * survives for historical expenses to reference.
 */
export async function requireMembership(groupId: string, userId: string): Promise<GroupMembership> {
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        isNull(groupMembers.removedAt),
      ),
    )
    .limit(1);

  if (!membership) throw new NotAMemberError();
  return membership;
}

/**
 * Throws `NotAMemberError` (404) if the caller isn't a current member, or
 * `NotGroupOwnerError` (403) if they are a member but not `owner`. `403` is
 * reserved for exactly this inside case.
 */
export async function requireOwner(groupId: string, userId: string): Promise<GroupMembership> {
  const membership = await requireMembership(groupId, userId);
  if (membership.role !== "owner") throw new NotGroupOwnerError();
  return membership;
}

/**
 * Throws `GroupArchivedError` (422) if the group is archived. Call this
 * only on the write path, after `requireMembership`/`requireOwner` — an
 * archived group stays readable, so nothing calls this on a `GET`. Takes an
 * already-loaded group rather than a `groupId` because every write service
 * that needs this already loaded the group row for its own data (e.g. its
 * `defaultCurrency`), and a second query here would be redundant.
 */
export function assertGroupNotArchived(group: { archivedAt: Date | null }): void {
  if (group.archivedAt) throw new GroupArchivedError();
}

/**
 * The id-addressed case, where the route carries an expense or settlement
 * id but no group id (security.md § the trap). Load the row by its own id
 * first, then pass it here — this reads *its* `group_id` and checks
 * membership against that, instead of trusting an unguessable-looking uuid
 * as its own authorization. `row` being `undefined` (the id doesn't exist
 * at all) is also a 404, via the same `NotAMemberError` — this deliberately
 * doesn't distinguish "no such row" from "row exists, you're not a member",
 * for the same unguessable-id reasoning as group access itself.
 */
export async function requireMembershipForRow<T extends { groupId: string }>(
  row: T | undefined,
  userId: string,
): Promise<{ row: T; membership: GroupMembership }> {
  if (!row) throw new NotAMemberError();
  const membership = await requireMembership(row.groupId, userId);
  return { row, membership };
}
