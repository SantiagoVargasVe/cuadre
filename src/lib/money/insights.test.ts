import { describe, expect, it } from "vitest";
import type { Ledger } from "./balances";
import { UnbalancedLedgerError } from "./errors";
import { aggregateInsights, perMemberBreakdown, type InsightExpense } from "./insights";

function expense(overrides: Partial<InsightExpense> = {}): InsightExpense {
  return { date: "2026-08-24", currency: "COP", category: null, total: 3000n, ...overrides };
}

describe("aggregateInsights", () => {
  it("returns nothing for an empty ledger", () => {
    expect(aggregateInsights([])).toEqual([]);
  });

  it("sums totals by day and by month, chronologically", () => {
    const [agg] = aggregateInsights([
      expense({ date: "2026-08-24", total: 1000n }),
      expense({ date: "2026-08-24", total: 500n }),
      expense({ date: "2026-09-02", total: 4000n }),
    ]);
    expect(agg!.byDay).toEqual([
      { key: "2026-08-24", amount: 1500n },
      { key: "2026-09-02", amount: 4000n },
    ]);
    expect(agg!.byMonth).toEqual([
      { key: "2026-08", amount: 1500n },
      { key: "2026-09", amount: 4000n },
    ]);
  });

  it("keeps the null category as its own bucket, never folded into otro", () => {
    const [agg] = aggregateInsights([
      expense({ category: "comida", total: 1000n }),
      expense({ category: "otro", total: 2000n }),
      expense({ category: null, total: 5000n }),
    ]);
    expect(agg!.byCategory).toEqual([
      { category: null, amount: 5000n },
      { category: "otro", amount: 2000n },
      { category: "comida", amount: 1000n },
    ]);
  });

  it("breaks a category-amount tie by key, with the null bucket last", () => {
    const [agg] = aggregateInsights([
      expense({ category: null, total: 1000n }),
      expense({ category: "transporte", total: 1000n }),
      expense({ category: "comida", total: 1000n }),
    ]);
    expect(agg!.byCategory.map((b) => b.category)).toEqual(["comida", "transporte", null]);
  });

  it("never sums across currencies — one aggregate per currency, code-sorted", () => {
    const aggs = aggregateInsights([
      expense({ currency: "USD", total: 80n }),
      expense({ currency: "COP", total: 3000n }),
    ]);
    expect(aggs.map((a) => a.currency)).toEqual(["COP", "USD"]);
    expect(aggs.find((a) => a.currency === "USD")!.byDay).toEqual([{ key: "2026-08-24", amount: 80n }]);
  });

  it("omits zero and negative buckets rather than emitting empty bars", () => {
    const [agg] = aggregateInsights([
      expense({ category: "comida", total: 0n }),
      expense({ category: "transporte", total: 1000n }),
    ]);
    expect(agg!.byCategory).toEqual([{ category: "transporte", amount: 1000n }]);
  });
});

describe("perMemberBreakdown", () => {
  const ledger = (over: Partial<Ledger> = {}): Ledger => ({
    paid: [],
    owed: [],
    sent: [],
    received: [],
    ...over,
  });

  it("splits paid/consumed/net per member, per currency", () => {
    const rows = perMemberBreakdown(
      ledger({
        paid: [
          { currency: "COP", memberId: "ana", amount: 2000n },
          { currency: "COP", memberId: "beto", amount: 0n },
        ],
        owed: [
          { currency: "COP", memberId: "ana", amount: 900n },
          { currency: "COP", memberId: "beto", amount: 1100n },
        ],
      }),
    );
    expect(rows.get("COP")).toEqual([
      { userId: "ana", paid: 2000n, consumed: 900n, expenseContribution: 1100n, sent: 0n, received: 0n, currentNet: 1100n },
      { userId: "beto", paid: 0n, consumed: 1100n, expenseContribution: -1100n, sent: 0n, received: 0n, currentNet: -1100n },
    ]);
  });

  it("folds settlements into currentNet but not expenseContribution", () => {
    const rows = perMemberBreakdown(
      ledger({
        paid: [{ currency: "COP", memberId: "ana", amount: 2000n }],
        owed: [
          { currency: "COP", memberId: "ana", amount: 1000n },
          { currency: "COP", memberId: "beto", amount: 1000n },
        ],
        sent: [{ currency: "COP", memberId: "beto", amount: 1000n }],
        received: [{ currency: "COP", memberId: "ana", amount: 1000n }],
      }),
    );
    const ana = rows.get("COP")!.find((r) => r.userId === "ana")!;
    expect(ana.expenseContribution).toBe(1000n); // paid 2000 − consumed 1000
    expect(ana.currentNet).toBe(0n); // ...then received the 1000 back
  });

  it("throws when Σ paid ≠ Σ consumed even though Σ currentNet is 0 (a corrupt ledger)", () => {
    // paid − consumed = +1000, offset by received − sent = −1000, so
    // computeBalances' Σ net == 0 check passes; the breakdown's own
    // Σ paid == Σ consumed canary is what catches this.
    expect(() =>
      perMemberBreakdown(
        ledger({
          paid: [{ currency: "COP", memberId: "ana", amount: 2000n }],
          owed: [{ currency: "COP", memberId: "ana", amount: 1000n }],
          received: [{ currency: "COP", memberId: "ana", amount: 1000n }],
        }),
      ),
    ).toThrow(UnbalancedLedgerError);
  });
});
