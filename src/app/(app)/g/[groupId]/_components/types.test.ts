import { describe, expect, it } from "vitest";
import { resolveDisplayAmounts, type ExpenseSummary } from "./types";

const base: ExpenseSummary = {
  id: "e1",
  title: "Cena",
  date: "2026-08-24",
  total: { amount: "30000000", currency: "COP" },
  payers: [{ userId: "ana", amount: "30000000", displayName: "Ana" }],
  splits: [
    { userId: "ana", amount: "15000000", displayName: "Ana" },
    { userId: "beto", amount: "15000000", displayName: "Beto" },
  ],
  strategy: "equal",
  converted: null,
  editedAt: null,
  editedBy: null,
};

describe("resolveDisplayAmounts", () => {
  it("uses the original amounts when there's no display currency", () => {
    const display = resolveDisplayAmounts(base);
    expect(display.currency).toBe("COP");
    expect(display.total).toEqual({ amount: 30000000n, currency: "COP" });
    expect(display.payers).toBe(base.payers);
    expect(display.splits).toBe(base.splits);
    expect(display.convertedFrom).toBeUndefined();
  });

  it("uses the converted total, payers, and splits together — never a mix of the two", () => {
    const expense: ExpenseSummary = {
      ...base,
      converted: {
        total: { amount: "7500", currency: "USD" },
        payers: [{ userId: "ana", amount: "7500", displayName: "Ana" }],
        splits: [
          { userId: "ana", amount: "3750", displayName: "Ana" },
          { userId: "beto", amount: "3750", displayName: "Beto" },
        ],
      },
    };

    const display = resolveDisplayAmounts(expense);
    expect(display.currency).toBe("USD");
    expect(display.total).toEqual({ amount: 7500n, currency: "USD" });
    expect(display.splits).toEqual(expense.converted!.splits);
    expect(display.convertedFrom).toEqual({
      original: { amount: 30000000n, currency: "COP" },
      pinnedAt: "2026-08-24",
    });
  });
});
