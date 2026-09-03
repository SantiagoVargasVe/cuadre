import type { BalancesResult, CurrencyBalancesView } from "./balancesTypes";
import { formatPaymentPlanForClipboard } from "./formatPaymentPlanForClipboard";

const NAMES: Record<string, string> = { ana: "Ana", beto: "Beto", caro: "Caro" };

/** Same `?` fallback `buildMemberLookup` gives the plan rows on screen. */
export const nameOf = (userId: string) => NAMES[userId] ?? "?";

export function block(partial: Partial<CurrencyBalancesView>): CurrencyBalancesView {
  return { currency: "COP", members: [], plan: [], simplified: false, ...partial };
}

export const copyPlan = (balances: BalancesResult) =>
  formatPaymentPlanForClipboard({ groupTitle: "Cartagena 2026", balances, nameOf });
