/**
 * Mirrors `SettlementResult`/`SettlementListResult` (server/services/settlements.ts)
 * — the wire shape from `GET /api/groups/:id/settlements`, `POST` and
 * `PATCH /api/settlements/:id` (api-contract.md § *Settlements*). Declared
 * here, not imported: `src/app/` never reaches into `src/server/`
 * (frontend/CLAUDE.md § *The hard rule*), types included.
 *
 * A settlement is a plain ledger entry — `from → to`, one amount, one date.
 * It is **not** linked to a plan edge; a settle-up form may prefill from one
 * as a convenience, but nothing here records or looks for that link
 * (ADR-0009).
 */
export interface SettlementView {
  id: string;
  fromUserId: string;
  toUserId: string;
  /** Minor units, as a string — never a JSON number (api-contract.md). */
  amount: string;
  currency: string;
  /** Calendar date, `YYYY-MM-DD`. */
  settledOn: string;
  note: string | null;
}

export interface SettlementListResult {
  items: SettlementView[];
  nextCursor: string | null;
}
