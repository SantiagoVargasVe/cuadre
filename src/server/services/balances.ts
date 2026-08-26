import "server-only";
import { sql } from "drizzle-orm";
import { type Balance, type LedgerEntry, computeBalances } from "../../lib/money/balances";
import { requireMembership } from "../auth/membership";
import { db } from "../db/client";

type LedgerRow = {
  kind: "paid" | "owed" | "sent" | "received";
  currency: string;
  member_id: string;
  amount: string;
};

/**
 * One query for the group's live ledger rows (T040's own acceptance
 * criteria), tagged by kind so a single round trip covers expense_payers,
 * expense_splits, and — as of T043 — settlements, rather than adding
 * separate queries per source.
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
    UNION ALL
    SELECT 'sent' AS kind, s.currency, s.from_user_id AS member_id, s.amount::text AS amount
    FROM settlements s
    WHERE s.group_id = ${groupId} AND s.deleted_at IS NULL
    UNION ALL
    SELECT 'received' AS kind, s.currency, s.to_user_id AS member_id, s.amount::text AS amount
    FROM settlements s
    WHERE s.group_id = ${groupId} AND s.deleted_at IS NULL
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
  const sent: LedgerEntry[] = [];
  const received: LedgerEntry[] = [];
  const byKind = { paid, owed, sent, received };
  for (const row of rows) {
    const entry = { currency: row.currency, memberId: row.member_id, amount: BigInt(row.amount) };
    byKind[row.kind].push(entry);
  }

  return computeBalances({ paid, owed, sent, received });
}
