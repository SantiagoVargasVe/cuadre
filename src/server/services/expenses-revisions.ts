import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { requireMembershipForRow } from "../auth/membership";
import { db } from "../db/client";
import { expenseRevisions, expenses, users } from "../db/schema";
import {
  diffSnapshots,
  parseSnapshot,
  type ExpenseSnapshot,
  type NameLookup,
  type RevisionChange,
} from "./expense-revision-diff";

export interface RevisionActor {
  userId: string;
  displayName: string;
}

export interface ExpenseRevisionView {
  version: number;
  action: "created" | "updated" | "deleted";
  changedAt: string;
  changedBy: RevisionActor | null;
  changes: RevisionChange[];
}

async function loadDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(inArray(users.id, userIds));
  return new Map(rows.map((row) => [row.id, row.displayName]));
}

function referencedUserIds(
  rows: (typeof expenseRevisions.$inferSelect)[],
  snapshots: (ExpenseSnapshot | null)[],
): string[] {
  const ids = new Set<string>();
  for (const row of rows) if (row.changedBy) ids.add(row.changedBy);
  for (const snapshot of snapshots) {
    for (const party of [...(snapshot?.payers ?? []), ...(snapshot?.splits ?? [])]) ids.add(party.userId);
  }
  return [...ids];
}

/**
 * Lists an expense's history newest first. This id-addressed read loads the
 * expense, then verifies membership against its own group id. Soft-deleted
 * expenses deliberately follow getExpense() and return the same 404.
 */
export async function listExpenseRevisions(expenseId: string, userId: string): Promise<ExpenseRevisionView[]> {
  const [expense] = await db
    .select({ id: expenses.id, groupId: expenses.groupId })
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), isNull(expenses.deletedAt)))
    .limit(1);
  await requireMembershipForRow(expense, userId);

  const rows = await db
    .select()
    .from(expenseRevisions)
    .where(eq(expenseRevisions.expenseId, expenseId))
    .orderBy(asc(expenseRevisions.version));
  const snapshots = rows.map((row) => parseSnapshot(row.snapshot));
  const names = await loadDisplayNames(referencedUserIds(rows, snapshots));
  const nameOf: NameLookup = (id) => names.get(id) ?? null;

  return rows
    .map((row, index) => {
      const changedBy = row.changedBy ? names.get(row.changedBy) : undefined;
      return {
        version: row.version,
        action: row.action,
        changedAt: row.changedAt.toISOString(),
        changedBy: changedBy ? { userId: row.changedBy!, displayName: changedBy } : null,
        changes: row.action === "updated" ? diffSnapshots(snapshots[index - 1] ?? null, snapshots[index]!, nameOf) : [],
      };
    })
    .reverse();
}
