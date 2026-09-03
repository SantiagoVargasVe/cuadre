import type { CurrencyInsightsView, InsightsResult, MemberBreakdownView, SummaryView } from "./insightsTypes";
import type { GroupMember } from "./types";

export const members: GroupMember[] = [
  { userId: "ana", displayName: "Ana", role: "owner" },
  { userId: "beto", displayName: "Beto", role: "member" },
];

export const row = (over: Partial<MemberBreakdownView> & { userId: string }): MemberBreakdownView => ({
  paid: "0", consumed: "0", expenseContribution: "0", sent: "0", received: "0", currentNet: "0", ...over,
});

export const summary = (over: Partial<SummaryView> = {}): SummaryView => ({
  totalSpent: "40000", expenseCount: 2, firstExpenseDate: "2026-08-24", lastExpenseDate: "2026-08-24",
  averagePerExpense: "20000", largestExpense: { title: "Cena", amount: "30000", currency: "COP", payers: ["Ana"] },
  carrying: { userId: "ana", amount: "15000" }, ...over,
});

export const block = (over: Partial<CurrencyInsightsView> = {}): CurrencyInsightsView => ({
  currency: "COP", summary: summary(), byDay: [{ key: "2026-08-24", amount: "40000" }],
  byMonth: [{ key: "2026-08", amount: "40000" }],
  byCategory: [{ category: "comida", amount: "30000" }, { category: null, amount: "10000" }],
  members: [row({ userId: "ana", paid: "40000", consumed: "25000", currentNet: "15000" }), row({ userId: "beto", consumed: "15000", currentNet: "-15000" })],
  ...over,
});

export const result = (...byCurrency: CurrencyInsightsView[]): InsightsResult => ({ displayCurrency: null, byCurrency });
