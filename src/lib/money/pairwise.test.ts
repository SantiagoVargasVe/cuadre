import { describe, expect, it } from "vitest";
import { computeBalances, type Ledger as BalanceLedger } from "./balances";
import { computePairwise, type PairwiseLedger } from "./pairwise";

function emptyLedger(): PairwiseLedger {
  return { expenses: [], settlements: [] };
}

describe("computePairwise", () => {
  it("the trivial case: single payer, single split member", () => {
    const ledger: PairwiseLedger = {
      expenses: [
        {
          currency: "COP",
          payers: new Map([["ana", 5000n]]),
          splits: new Map([["beto", 5000n]]),
        },
      ],
      settlements: [],
    };

    expect(computePairwise(ledger)).toEqual([
      { from: "beto", to: "ana", currency: "COP", amount: 5000n },
    ]);
  });

  it("eliminates a self-edge rather than rendering it as zero", () => {
    const ledger: PairwiseLedger = {
      expenses: [
        {
          currency: "COP",
          payers: new Map([["ana", 5000n]]),
          splits: new Map([["ana", 5000n]]),
        },
      ],
      settlements: [],
    };
    expect(computePairwise(ledger)).toEqual([]);
  });

  it("splits the equal-three-way worked example: Ana pays, Beto and Caro each owe her", () => {
    const ledger: PairwiseLedger = {
      expenses: [
        {
          currency: "COP",
          payers: new Map([["ana", 30000n]]),
          splits: new Map([
            ["ana", 10000n],
            ["beto", 10000n],
            ["caro", 10000n],
          ]),
        },
      ],
      settlements: [],
    };

    const result = computePairwise(ledger);
    expect(result).toEqual([
      { from: "beto", to: "ana", currency: "COP", amount: 10000n },
      { from: "caro", to: "ana", currency: "COP", amount: 10000n },
    ]);
  });

  it("attributes multi-payer expenses proportionally, netting to the same position as computeBalances", () => {
    // paid Ana=6000, Beto=4000; split 5000/5000 — from T040's own test,
    // net Ana=+1000, net Beto=-1000. Pairwise must agree.
    const ledger: PairwiseLedger = {
      expenses: [
        {
          currency: "COP",
          payers: new Map([
            ["ana", 6000n],
            ["beto", 4000n],
          ]),
          splits: new Map([
            ["ana", 5000n],
            ["beto", 5000n],
          ]),
        },
      ],
      settlements: [],
    };

    expect(computePairwise(ledger)).toEqual([
      { from: "beto", to: "ana", currency: "COP", amount: 1000n },
    ]);
  });

  it("nets a settlement against the expense-derived debt, dropping the pair once it clears", () => {
    const ledger: PairwiseLedger = {
      expenses: [
        {
          currency: "COP",
          payers: new Map([["ana", 10000n]]),
          splits: new Map([["beto", 10000n]]),
        },
      ],
      settlements: [{ currency: "COP", from: "beto", to: "ana", amount: 10000n }],
    };
    expect(computePairwise(ledger)).toEqual([]);
  });

  it("a settlement overshooting an expense debt flips the edge direction", () => {
    // A valid balanced expense: Ana pays 10000, split 5000/5000 with Beto
    // (Σpayers === Σsplits === 10000, same as any real persisted expense).
    // Beto owes 5000 but settles a round 8000 — overshoots by 3000.
    const ledger: PairwiseLedger = {
      expenses: [
        {
          currency: "COP",
          payers: new Map([["ana", 10000n]]),
          splits: new Map([
            ["ana", 5000n],
            ["beto", 5000n],
          ]),
        },
      ],
      settlements: [{ currency: "COP", from: "beto", to: "ana", amount: 8000n }],
    };
    expect(computePairwise(ledger)).toEqual([
      { from: "ana", to: "beto", currency: "COP", amount: 3000n },
    ]);
  });

  it("keeps currencies independent — no cross-currency netting", () => {
    const ledger: PairwiseLedger = {
      expenses: [
        {
          currency: "COP",
          payers: new Map([["ana", 1000n]]),
          splits: new Map([["beto", 1000n]]),
        },
        {
          currency: "USD",
          payers: new Map([["beto", 100n]]),
          splits: new Map([["ana", 100n]]),
        },
      ],
      settlements: [],
    };
    const result = computePairwise(ledger);
    expect(result).toContainEqual({ from: "beto", to: "ana", currency: "COP", amount: 1000n });
    expect(result).toContainEqual({ from: "ana", to: "beto", currency: "USD", amount: 100n });
    expect(result).toHaveLength(2);
  });

  it("is deterministic: the same ledger always produces the same ordered output", () => {
    const ledger: PairwiseLedger = {
      expenses: [
        {
          currency: "COP",
          payers: new Map([["ana", 30000n]]),
          splits: new Map([
            ["ana", 10000n],
            ["beto", 10000n],
            ["caro", 10000n],
          ]),
        },
      ],
      settlements: [],
    };
    const first = computePairwise(ledger);
    for (let i = 0; i < 5; i++) {
      expect(computePairwise(ledger)).toEqual(first);
    }
  });

  it("Σ pairwise(m) == net(m) on a ledger with several expenses and a settlement", () => {
    const ledger: PairwiseLedger = {
      expenses: [
        {
          currency: "COP",
          payers: new Map([
            ["ana", 6000n],
            ["beto", 4000n],
          ]),
          splits: new Map([
            ["ana", 5000n],
            ["beto", 5000n],
          ]),
        },
        {
          currency: "COP",
          payers: new Map([["caro", 3000n]]),
          splits: new Map([
            ["ana", 1000n],
            ["beto", 1000n],
            ["caro", 1000n],
          ]),
        },
      ],
      settlements: [{ currency: "COP", from: "beto", to: "ana", amount: 500n }],
    };

    const pairwise = computePairwise(ledger);

    const balanceLedger: BalanceLedger = { paid: [], owed: [], sent: [], received: [] };
    for (const expense of ledger.expenses) {
      for (const [memberId, amount] of expense.payers) {
        balanceLedger.paid.push({ currency: expense.currency, memberId, amount });
      }
      for (const [memberId, amount] of expense.splits) {
        balanceLedger.owed.push({ currency: expense.currency, memberId, amount });
      }
    }
    for (const settlement of ledger.settlements) {
      balanceLedger.sent.push({
        currency: settlement.currency,
        memberId: settlement.from,
        amount: settlement.amount,
      });
      balanceLedger.received.push({
        currency: settlement.currency,
        memberId: settlement.to,
        amount: settlement.amount,
      });
    }
    const balances = computeBalances(balanceLedger);

    for (const [currency, byMember] of balances) {
      for (const [memberId, balance] of byMember) {
        const owedToMember = pairwise
          .filter((d) => d.to === memberId && d.currency === currency)
          .reduce((sum, d) => sum + d.amount, 0n);
        const owedByMember = pairwise
          .filter((d) => d.from === memberId && d.currency === currency)
          .reduce((sum, d) => sum + d.amount, 0n);
        expect(owedToMember - owedByMember).toBe(balance.net);
      }
    }
  });

  it("an empty ledger produces no edges", () => {
    expect(computePairwise(emptyLedger())).toEqual([]);
  });
});
