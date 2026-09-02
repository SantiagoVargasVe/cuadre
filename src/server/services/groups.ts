import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { AvatarChoice } from "../../lib/avatar";
import { config } from "../config";
import { avatarColumns, toAvatarChoice } from "../db/avatar";
import { db, withTransaction } from "../db/client";
import { groupMembers, groups, users } from "../db/schema";
import { assertGroupNotArchived, requireMembership, requireOwner } from "../auth/membership";
import { assertSupportedCurrency } from "./currencies";

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
  /** The member's chosen avatar, or `null` for the T107 default (T108). */
  avatar: AvatarChoice | null;
}

export interface GroupSettings {
  displayCurrency: string | null;
  simplifyDebts: boolean;
}

export interface GroupDetail {
  group: Group;
  members: GroupMemberSummary[];
  settings: GroupSettings;
}

/**
 * Members are returned as display name + id only — **never email
 * addresses** (security.md § Privacy) — regardless of who's asking,
 * ordered by `joined_at` then `user_id` so the list is stable run to run
 * (same tiebreak reasoning as `listMembers`).
 * `settings` duplicates `displayCurrency`/`simplifyDebts` out of `group`
 * as their own object (api-contract.md § Groups) so the UI can read the
 * two things that decide *how* it renders — display currency, simplify
 * toggle — without reaching into the full group row for them.
 */
export async function getGroupDetail(groupId: string, userId: string): Promise<GroupDetail> {
  await requireMembership(groupId, userId);

  // Guaranteed to exist: a live group_members row FKs to groups(id) with no
  // way to outlive it (schema.ts), so requireMembership succeeding already
  // proves this row is there.
  const [[group], memberRows] = await Promise.all([
    db.select().from(groups).where(eq(groups.id, groupId)).limit(1),
    db
      .select({
        userId: groupMembers.userId,
        displayName: users.displayName,
        role: groupMembers.role,
        ...avatarColumns,
      })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.removedAt)))
      .orderBy(asc(groupMembers.joinedAt), asc(groupMembers.userId)),
  ]);

  return {
    group: group!,
    members: memberRows.map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      role: m.role,
      avatar: toAvatarChoice(m),
    })),
    settings: { displayCurrency: group!.displayCurrency, simplifyDebts: group!.simplifyDebts },
  };
}

export interface MyGroupSummary {
  id: string;
  title: string;
  archivedAt: string | null;
  memberCount: number;
  yourNet: { currency: string; net: string }[];
}

type MyGroupRow = {
  group_id: string;
  title: string;
  archived_at: string | null;
  member_count: number;
  currency: string | null;
  net: string | null;
};

/**
 * Every non-archived *and* archived group the user currently belongs to,
 * with their own net position per currency (api-contract.md § Groups) —
 * archived groups are flagged via `archivedAt`, never silently dropped,
 * so a finished trip doesn't vanish from the list it once appeared in.
 *
 * **One query, not N+1 across groups** (architecture.md): a single
 * statement — CTEs, not round trips — computes membership, member counts,
 * and this user's own paid/owed/sent/received per group and currency
 * together. Deliberately only *this* user's ledger rows, not every
 * member's — unlike the balances endpoint, this never needs anyone else's
 * position, so there's no `computeBalances`/`Σ net == 0` here: that
 * invariant only makes sense once every member's net for a group is in
 * hand, not one person's alone.
 */
export async function listMyGroups(userId: string): Promise<MyGroupSummary[]> {
  const rows = await db.execute<MyGroupRow>(sql`
    WITH my_groups AS (
      SELECT gm.group_id, g.title, g.archived_at,
        (SELECT count(*)::int FROM group_members gm2
         WHERE gm2.group_id = gm.group_id AND gm2.removed_at IS NULL) AS member_count
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_id = ${userId} AND gm.removed_at IS NULL
    ),
    ledger AS (
      SELECT e.group_id, e.currency, ep.amount AS paid, 0::bigint AS owed, 0::bigint AS sent, 0::bigint AS received
      FROM expense_payers ep JOIN expenses e ON e.id = ep.expense_id
      WHERE ep.user_id = ${userId} AND e.deleted_at IS NULL
      UNION ALL
      SELECT e.group_id, e.currency, 0::bigint, es.amount, 0::bigint, 0::bigint
      FROM expense_splits es JOIN expenses e ON e.id = es.expense_id
      WHERE es.user_id = ${userId} AND e.deleted_at IS NULL
      UNION ALL
      SELECT s.group_id, s.currency, 0::bigint, 0::bigint, s.amount, 0::bigint
      FROM settlements s
      WHERE s.from_user_id = ${userId} AND s.deleted_at IS NULL
      UNION ALL
      SELECT s.group_id, s.currency, 0::bigint, 0::bigint, 0::bigint, s.amount
      FROM settlements s
      WHERE s.to_user_id = ${userId} AND s.deleted_at IS NULL
    ),
    nets AS (
      SELECT group_id, currency, (SUM(paid) - SUM(owed) + SUM(sent) - SUM(received))::text AS net
      FROM ledger
      GROUP BY group_id, currency
    )
    SELECT mg.group_id, mg.title, mg.archived_at, mg.member_count, n.currency, n.net
    FROM my_groups mg
    LEFT JOIN nets n ON n.group_id = mg.group_id
    ORDER BY mg.title, n.currency
  `);

  const byGroup = new Map<string, MyGroupSummary>();
  for (const row of rows) {
    let group = byGroup.get(row.group_id);
    if (!group) {
      group = {
        id: row.group_id,
        title: row.title,
        archivedAt: row.archived_at,
        memberCount: row.member_count,
        yourNet: [],
      };
      byGroup.set(row.group_id, group);
    }
    if (row.currency !== null && row.net !== null) {
      group.yourNet.push({ currency: row.currency, net: row.net });
    }
  }
  return [...byGroup.values()];
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
