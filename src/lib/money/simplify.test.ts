import { describe, expect, it } from "vitest";
import type { PairwiseDebt } from "./pairwise";
import { explainSimplifiedPlan, simplify } from "./simplify";

function net(pairs: [string, bigint][]): Map<string, bigint> {
  return new Map(pairs);
}

describe("simplify", () => {
  it("collapses the classic A owes B, C owes B case (already minimal)", () => {
    const result = simplify(
      net([
        ["ana", 20000n],
        ["beto", -10000n],
        ["caro", -10000n],
      ]),
    );
    expect(result).toEqual([
      { from: "beto", to: "ana", amount: 10000n },
      { from: "caro", to: "ana", amount: 10000n },
    ]);
  });

  it("yields zero edges for an already-settled group", () => {
    const result = simplify(
      net([
        ["ana", 0n],
        ["beto", 0n],
      ]),
    );
    expect(result).toEqual([]);
  });

  it("yields exactly n-1 edges when one member owes everyone else", () => {
    // ana owes 300 total; beto/caro/dan are each owed 100. n=4, so n-1=3.
    const result = simplify(
      net([
        ["ana", -300n],
        ["beto", 100n],
        ["caro", 100n],
        ["dan", 100n],
      ]),
    );
    expect(result).toHaveLength(3);
    expect(result.reduce((sum, e) => sum + e.amount, 0n)).toBe(300n);
    expect(result.every((e) => e.from === "ana")).toBe(true);
  });

  it("is stable across repeated runs on the same input", () => {
    const nets = net([
      ["ana", 15000n],
      ["beto", -5000n],
      ["caro", -10000n],
    ]);
    const first = simplify(nets);
    for (let i = 0; i < 5; i++) expect(simplify(nets)).toEqual(first);
  });

  it("breaks ties in the debtor/creditor ordering by member id", () => {
    // beto and caro both owe exactly 5000 — "beto" must be settled first.
    const result = simplify(
      net([
        ["ana", 10000n],
        ["beto", -5000n],
        ["caro", -5000n],
      ]),
    );
    expect(result[0]).toEqual({ from: "beto", to: "ana", amount: 5000n });
    expect(result[1]).toEqual({ from: "caro", to: "ana", amount: 5000n });
  });

  it("never emits more than n-1 edges, and the plan re-derives the same net for every member", () => {
    const nets = net([
      ["a", 4000n],
      ["b", 3000n],
      ["c", -1000n],
      ["d", -2000n],
      ["e", -4000n],
    ]);
    const result = simplify(nets);
    expect(result.length).toBeLessThanOrEqual(4);

    // net(m), re-derived from the plan itself, must match the net(m) that
    // went in — simplification only re-routes who pays whom.
    const derivedNet = new Map([...nets.keys()].map((id) => [id, 0n]));
    for (const { from, to, amount } of result) {
      derivedNet.set(from, derivedNet.get(from)! - amount);
      derivedNet.set(to, derivedNet.get(to)! + amount);
    }
    for (const [member, original] of nets) {
      expect(derivedNet.get(member)).toBe(original);
    }
  });
});

function debt(from: string, to: string, amount: bigint, currency = "COP"): PairwiseDebt {
  return { from, to, amount, currency };
}

describe("explainSimplifiedPlan", () => {
  it("explains the worked chain example: you paid via Beto, simplified to pay Ana directly", () => {
    const edges = simplify(
      net([
        ["you", -4000n],
        ["beto", 0n],
        ["ana", 4000n],
      ]),
    );
    const raw = [debt("you", "beto", 4000n), debt("beto", "ana", 4000n)];

    const explained = explainSimplifiedPlan(edges, raw);
    expect(explained).toHaveLength(1);
    expect(explained[0]!.from).toBe("you");
    expect(explained[0]!.to).toBe("ana");
    expect(explained[0]!.explains).toEqual([
      debt("beto", "ana", 4000n),
      debt("you", "beto", 4000n),
    ]);
  });

  it("omits explains when a simplified edge is exactly the same as the one raw debt behind it", () => {
    const edges = simplify(net([["ana", 5000n], ["beto", -5000n]]));
    const raw = [debt("beto", "ana", 5000n)];

    const explained = explainSimplifiedPlan(edges, raw);
    expect(explained).toEqual([{ from: "beto", to: "ana", amount: 5000n, explains: [] }]);
  });

  it("cites both original debts on each side of a genuine swap", () => {
    // d1 originally owed c2, and d2 originally owed c1 — the same amount
    // each way. The greedy match pairs the alphabetically-smaller ids
    // together instead (d1->c1, d2->c2), a real reroute: neither
    // simplified edge existed in the raw graph, and untangling *either*
    // one only makes sense by citing *both* original debts together.
    const raw = [debt("d1", "c2", 100n), debt("d2", "c1", 100n)];
    const edges = simplify(
      net([
        ["d1", -100n],
        ["c2", 100n],
        ["d2", -100n],
        ["c1", 100n],
      ]),
    );
    expect(edges).toEqual([
      { from: "d1", to: "c1", amount: 100n },
      { from: "d2", to: "c2", amount: 100n },
    ]);

    const explained = explainSimplifiedPlan(edges, raw);
    const expectedExplanation = [debt("d1", "c2", 100n), debt("d2", "c1", 100n)];
    expect(explained).toEqual([
      { from: "d1", to: "c1", amount: 100n, explains: expectedExplanation },
      { from: "d2", to: "c2", amount: 100n, explains: expectedExplanation },
    ]);
  });

  it("never crashes and always drops the amounts to zero net effect when there are no raw debts", () => {
    const edges = simplify(net([["ana", 100n], ["beto", -100n]]));
    const explained = explainSimplifiedPlan(edges, []);
    expect(explained).toEqual([{ from: "beto", to: "ana", amount: 100n, explains: [] }]);
  });
});
