/**
 * Wire shapes for the Ajustes tab. Mirrors `MemberSummary`
 * (server/services/members.ts) and the display-currency endpoint
 * (api-contract.md § Currency). Declared here, not imported from
 * `src/server/` (frontend/CLAUDE.md § *The hard rule*).
 */
export interface MemberSummary {
  userId: string;
  displayName: string;
  role: "owner" | "member";
  /** RFC 3339 UTC. */
  joinedAt: string;
  /** The member's chosen avatar; `null` / absent → the T107 default (T108). */
  avatar?: import("../../../../../lib/avatar").AvatarChoice | null;
}

export interface FxPin {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  asOf: string;
  source: string;
}

export interface DisplayCurrencyState {
  currency: string | null;
  pins: FxPin[];
  /** The provider a conversion would pin from — named in the confirm step. */
  source: string;
}

/** `details.balances` on a `422 MEMBER_HAS_BALANCE` from member removal. */
export interface OutstandingBalance {
  currency: string;
  /** Minor units, signed, as a string. */
  net: string;
}
