import { es } from "../../../../../lib/i18n/es";
import { formatMoney } from "../../../../../lib/money/format";

const t = es.balances;

export interface PlanEdgeLike {
  from: string;
  to: string;
  amount: string;
}

/**
 * "Ana te debe $ 20.000" and "le debes a Ana $ 20.000" are different
 * sentences, not the same number with a sign (splitting.md § 5, frontend/
 * CLAUDE.md § *Balances and the simplify toggle*) — this is the one place
 * that picks which sentence, from `myUserId`'s point of view, shared by a
 * plan row's own label and each raw debt line inside its explain dialog.
 */
export function planEdgePhrase(
  edge: PlanEdgeLike,
  currency: string,
  myUserId: string,
  nameOf: (userId: string) => string,
): string {
  const formatted = formatMoney({ amount: BigInt(edge.amount), currency });
  if (edge.from === myUserId) return t.youOwe(nameOf(edge.to), formatted);
  if (edge.to === myUserId) return t.owesYou(nameOf(edge.from), formatted);
  return t.owesOther(nameOf(edge.from), nameOf(edge.to), formatted);
}
