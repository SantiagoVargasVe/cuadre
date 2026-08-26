import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { config } from "../config";
import { db, withTransaction } from "../db/client";
import { groupMembers, groups, users } from "../db/schema";
import { assertGroupNotArchived, requireMembership, requireOwner } from "../auth/membership";
import { ValidationError } from "../errors";

/** `defaultCurrency` isn't one of the three the app is configured to support. */
export class UnsupportedCurrencyError extends ValidationError {
  constructor(currency: string) {
    super("CURRENCY_NOT_SUPPORTED", `Currency ${currency} is not supported`, { currency });
    this.name = "UnsupportedCurrencyError";
  }
}

function assertSupportedCurrency(code: string): void {
  if (!(config.SUPPORTED_CURRENCIES as readonly string[]).includes(code)) {
    throw new UnsupportedCurrencyError(code);
  }
}

export type Group = typeof groups.$inferSelect;

export interface CreateGroupInput {
  title: string;
  description?: string;
  defaultCurrency?: string;
}

/**
 * Creates the group and its creator's `owner` membership in one
 * transaction — a group with no owner, or an owner row with no group, are
 * both states nothing downstream expects to handle.
 */
export async function createGroup(userId: string, input: CreateGroupInput): Promise<Group> {
  const defaultCurrency = input.defaultCurrency ?? config.DEFAULT_CURRENCY;
  assertSupportedCurrency(defaultCurrency);

  return withTransaction(async (tx) => {
    const [group] = await tx
      .insert(groups)
      .values({ title: input.title, description: input.description, defaultCurrency, createdBy: userId })
      .returning();
    if (!group) throw new Error("Insert into groups returned no row");

    await tx.insert(groupMembers).values({ groupId: group.id, userId, role: "owner" });

    return group;
  });
}

export interface GroupMemberSummary {
  userId: string;
  displayName: string;
  role: "owner" | "member";
}

export interface GroupDetail {
  group: Group;
  members: GroupMemberSummary[];
}

/**
 * Members are returned as display name + id only — **never email
 * addresses** (security.md § Privacy) — regardless of who's asking.
 */
export async function getGroupDetail(groupId: string, userId: string): Promise<GroupDetail> {
  await requireMembership(groupId, userId);

  // Guaranteed to exist: a live group_members row FKs to groups(id) with no
  // way to outlive it (schema.ts), so requireMembership succeeding already
  // proves this row is there.
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);

  const members = await db
    .select({ userId: groupMembers.userId, displayName: users.displayName, role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.removedAt)));

  return { group: group!, members };
}

export interface UpdateGroupInput {
  title?: string;
  description?: string;
  simplifyDebts?: boolean;
}

/**
 * Any current member may update a group — including its title — the same
 * "permissions are friction against the actual failure mode" reasoning
 * security.md applies to editing expenses. Only `POST .../archive` is
 * owner-gated (T022's acceptance criteria test this split explicitly).
 * `simplifyDebts` is a plain boolean flip and nothing else — ADR-0006.
 */
export async function updateGroup(
  groupId: string,
  userId: string,
  input: UpdateGroupInput,
): Promise<Group> {
  await requireMembership(groupId, userId);
  const [existing] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  assertGroupNotArchived(existing!);

  const patch: Partial<typeof groups.$inferInsert> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.simplifyDebts !== undefined) patch.simplifyDebts = input.simplifyDebts;
  if (Object.keys(patch).length === 0) return existing!;
  patch.updatedAt = new Date();

  const [updated] = await db.update(groups).set(patch).where(eq(groups.id, groupId)).returning();
  return updated!;
}

/** Owner only. Archiving an already-archived group is a harmless no-op, not an error. */
export async function archiveGroup(groupId: string, userId: string): Promise<Group> {
  await requireOwner(groupId, userId);
  const [existing] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (existing!.archivedAt) return existing!;

  const [archived] = await db
    .update(groups)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(groups.id, groupId))
    .returning();
  return archived!;
}
