import { assertPositive } from "../parse";

/**
 * Sugar for a one-payer, one-split expense at 100% — not a distinct row
 * type, no `is_loan` column (ADR-0005). The payer side (who lent it) is an
 * ordinary `expense_payers` entry the caller builds separately; this only
 * resolves the split side.
 */
export function resolveLoanSplit(beneficiaryId: string, total: bigint): Map<string, bigint> {
  assertPositive(total);
  return new Map([[beneficiaryId, total]]);
}
