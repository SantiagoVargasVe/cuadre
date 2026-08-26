/**
 * Mirrors `BalanceMember`/`PlanEdgeView`/`CurrencyBalances`/`BalancesView`
 * (server/services/balances.ts) — the wire shape from
 * `GET /api/groups/:id/balances` (api-contract.md § *Balances*). Split out
 * of `types.ts` (frontend/CLAUDE.md's own 100-line limit applies to that
 * file too), not because balances types are a different concern from the
 * rest of the group's wire shapes.
 */
export interface BalanceMemberView {
  userId: string;
  paid: string;
  owed: string;
  net: string;
}

export interface PlanEdgeView {
  from: string;
  to: string;
  amount: string;
  explains?: { from: string; to: string; amount: string }[];
}

export interface PinView {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  asOf: string;
  source: string;
}

export interface CurrencyBalancesView {
  currency: string;
  members: BalanceMemberView[];
  plan: PlanEdgeView[];
  simplified: boolean;
  pins?: PinView[];
}

export interface BalancesResult {
  displayCurrency: string | null;
  byCurrency: CurrencyBalancesView[];
}
