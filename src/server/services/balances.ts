import "server-only";
import { sql } from "drizzle-orm";
import { type Balance, type LedgerEntry, computeBalances } from "../../lib/money/balances";
import { requireMembership } from "../auth/membership";
import { db } from "../db/client";

type LedgerRow = {
  kind: "paid" | "owed";
  currency: string;
  member_id: string;
  amount: string;
};

/**
 * One query for the group's live ledger rows (T040's own acceptance
 * criteria), tagged by kind so a single round trip covers both
 * expense_payers and expense_splits — extend this same UNION when T043
 * adds settlements, rather than adding separate queries.
 */
async function loadLedgerRows(groupId: string): Promise<LedgerRow[]> {
  return db.execute<LedgerRow>(sql`
    SELECT 'paid' AS kind, e.currency, ep.user_id AS member_id, ep.amount::text AS amount
    FROM expense_payers ep
    JOIN expenses e ON e.id = ep.expense_id
    WHERE e.group_id = ${groupId} AND e.deleted_at IS NULL
    UNION ALL
    SELECT 'owed' AS kind, e.currency, es.user_id AS member_id, es.amount::text AS amount
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    WHERE e.group_id = ${groupId} AND e.deleted_at IS NULL
  `);
}

/**
 * Net position per member, per currency, for a group (splitting.md §4).
 * Pure computation lives in src/lib/money/balances.ts; this only fetches
 * the raw rows and shapes them into that function's Ledger input. No
 * cached balances table — a stored value that can disagree with the
 * ledger is the exact failure this design avoids (architecture.md).
 */
export async function getGroupBalances(
  groupId: string,
  userId: string,
): Promise<Map<string, Map<string, Balance>>> {
  await requireMembership(groupId, userId);

  const rows = await loadLedgerRows(groupId);

  const paid: LedgerEntry[] = [];
  const owed: LedgerEntry[] = [];
  for (const row of rows) {
    const entry = { currency: row.currency, memberId: row.member_id, amount: BigInt(row.amount) };
    (row.kind === "paid" ? paid : owed).push(entry);
  }

  // sent/received are always empty until T043 adds settlements — the
  // shape already accounts for them so that task only has to extend
  // loadLedgerRows and this array, not computeBalances itself.
  return computeBalances({ paid, owed, sent: [], received: [] });
}
