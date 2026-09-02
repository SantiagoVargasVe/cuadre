import { describe, expect, it } from "vitest";
import { aggregateInsights, type InsightExpense } from "./insights";

function expense(overrides: Partial<InsightExpense> = {}): InsightExpense {
  return {
    date: "2026-08-24",
    currency: "COP",
    category: null,
    total: 3000n,
    splits: new Map([
      ["ana", 1000n],
      ["beto", 2000n],
    ]),
    ...overrides,
  };
}

describe("aggregateInsights", () => {
  it("returns nothing for an empty ledger", () => {
    expect(aggregateInsights([])).toEqual([]);
  });

  it("sums totals by day and by month, chronologically", () => {
    const [agg] = aggregateInsights([
      expense({ date: "2026-08-24", total: 1000n, splits: new Map([["ana", 1000n]]) }),
      expense({ date: "2026-08-24", total: 500n, splits: new Map([["ana", 500n]]) }),
      expense({ date: "2026-09-02", total: 4000n, splits: new Map([["ana", 4000n]]) }),
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

  it("sums each member's splits, biggest consumer first", () => {
    const [agg] = aggregateInsights([
      expense({ splits: new Map([["ana", 1000n], ["beto", 2000n]]) }),
      expense({ splits: new Map([["ana", 1000n], ["beto", 500n]]) }),
    ]);
    expect(agg!.byMember).toEqual([
      { userId: "beto", amount: 2500n },
      { userId: "ana", amount: 2000n },
    ]);
  });

  it("keeps the null category as its own bucket, never folded into otro", () => {
    const [agg] = aggregateInsights([
      expense({ category: "comida", total: 1000n, splits: new Map([["ana", 1000n]]) }),
      expense({ category: "otro", total: 2000n, splits: new Map([["ana", 2000n]]) }),
      expense({ category: null, total: 5000n, splits: new Map([["ana", 5000n]]) }),
    ]);
    expect(agg!.byCategory).toEqual([
      { category: null, amount: 5000n },
      { category: "otro", amount: 2000n },
      { category: "comida", amount: 1000n },
    ]);
  });

  it("never sums across currencies — one aggregate per currency, code-sorted", () => {
    const aggs = aggregateInsights([
      expense({ currency: "USD", total: 80n, splits: new Map([["ana", 80n]]) }),
      expense({ currency: "COP", total: 3000n, splits: new Map([["ana", 3000n]]) }),
    ]);
    expect(aggs.map((a) => a.currency)).toEqual(["COP", "USD"]);
    expect(aggs.find((a) => a.currency === "USD")!.byDay).toEqual([{ key: "2026-08-24", amount: 80n }]);
    expect(aggs.find((a) => a.currency === "COP")!.byDay).toEqual([{ key: "2026-08-24", amount: 3000n }]);
  });

  it("omits zero and negative buckets rather than emitting empty bars", () => {
    const [agg] = aggregateInsights([
      expense({ category: "comida", total: 0n, splits: new Map() }),
      expense({ category: "transporte", total: 1000n, splits: new Map([["ana", 1000n]]) }),
    ]);
    expect(agg!.byCategory).toEqual([{ category: "transporte", amount: 1000n }]);
    expect(agg!.byMember).toEqual([{ userId: "ana", amount: 1000n }]);
  });

  it("is deterministic across runs for tied amounts", () => {
    const rows = [
      expense({ splits: new Map([["zoe", 1000n], ["ana", 1000n]]), total: 2000n }),
    ];
    expect(aggregateInsights(rows)[0]!.byMember).toEqual(aggregateInsights(rows)[0]!.byMember);
    expect(aggregateInsights(rows)[0]!.byMember).toEqual([
      { userId: "ana", amount: 1000n },
      { userId: "zoe", amount: 1000n },
    ]);
  });
});
