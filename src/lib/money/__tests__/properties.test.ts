import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeBalances, type Ledger, type LedgerEntry } from "../balances";
import {
  computePairwise as realComputePairwise,
  type PairwiseLedger,
} from "../pairwise";
import { type GeneratedExpense, type GeneratedLedger, genLedger } from "./generators";

/**
 * The single highest-value test suite in the repo (testing.md, splitting.md
 * §8): these are the invariants that must hold for *every* ledger, not just
 * the cases T031's unit tests thought of. `numRuns` is tuned to stay well
 * under a second locally; fast-check prints the failing seed automatically
 * on any failure, so a run is always reproducible from CI output alone.
 */
const NUM_RUNS = 300;

function sum(values: Iterable<bigint>): bigint {
  let total = 0n;
  for (const v of values) total += v;
  return total;
}

describe("apportionment invariants over random ledgers", () => {
  it("Σ splits == total for every expense", () => {
    fc.assert(
      fc.property(fc.gen(), (g) => {
        const ledger = genLedger(g);
        for (const expense of ledger.expenses) {
          expect(sum(expense.splits.values())).toBe(expense.total);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("Σ payers == total for every expense", () => {
    fc.assert(
      fc.property(fc.gen(), (g) => {
        const ledger = genLedger(g);
        for (const expense of ledger.expenses) {
          expect(sum(expense.payers.values())).toBe(expense.total);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("every split and payer amount is on a real member of the ledger", () => {
    fc.assert(
      fc.property(fc.gen(), (g) => {
        const ledger = genLedger(g);
        const members = new Set(ledger.memberIds);
        for (const expense of ledger.expenses) {
          for (const id of expense.splits.keys()) expect(members.has(id)).toBe(true);
          for (const id of expense.payers.keys()) expect(members.has(id)).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("every settlement moves money between two distinct real members", () => {
    fc.assert(
      fc.property(fc.gen(), (g) => {
        const ledger = genLedger(g);
        const members = new Set(ledger.memberIds);
        for (const settlement of ledger.settlements) {
          expect(members.has(settlement.from)).toBe(true);
          expect(members.has(settlement.to)).toBe(true);
          expect(settlement.from).not.toBe(settlement.to);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

/**
 * Balances, pairwise attribution, simplification, and conversion don't
 * exist yet (E5/E6). These properties are written now, against the
 * contract those tasks must satisfy, and skipped — **T040, T041, T042,
 * and T054 each enable theirs** by swapping the matching stub below for a
 * real import and removing `.skip`. A pending property is a contract, not
 * a TODO: don't delete one because "the function doesn't exist yet."
 */

interface CurrencyNet {
  currency: string;
  net: Map<string, bigint>;
}

/**
 * T040 implemented src/lib/money/balances.ts — net(m,c) = paid − owed +
 * sent − received. This adapter only reshapes GeneratedLedger into
 * computeBalances()'s flat-entry input and its Map-of-Maps output back
 * into the CurrencyNet[] shape the pairwise/simplification stubs below
 * already expect, so T041/T042 don't need to change anything when they
 * enable their own properties.
 */
function toLedgerInput(ledger: GeneratedLedger): Ledger {
  const paid: LedgerEntry[] = [];
  const owed: LedgerEntry[] = [];
  const sent: LedgerEntry[] = [];
  const received: LedgerEntry[] = [];

  for (const expense of ledger.expenses) {
    for (const [memberId, amount] of expense.payers) {
      paid.push({ currency: expense.currency, memberId, amount });
    }
    for (const [memberId, amount] of expense.splits) {
      owed.push({ currency: expense.currency, memberId, amount });
    }
  }
  for (const settlement of ledger.settlements) {
    sent.push({ currency: settlement.currency, memberId: settlement.from, amount: settlement.amount });
    received.push({ currency: settlement.currency, memberId: settlement.to, amount: settlement.amount });
  }

  return { paid, owed, sent, received };
}

function computeNet(ledger: GeneratedLedger): CurrencyNet[] {
  const byCurrency = computeBalances(toLedgerInput(ledger));
  return [...byCurrency].map(([currency, byMember]) => ({
    currency,
    net: new Map([...byMember].map(([memberId, balance]) => [memberId, balance.net])),
  }));
}

interface PairwiseDebt {
  from: string;
  to: string;
  currency: string;
  amount: bigint;
}

/**
 * T041 implemented src/lib/money/pairwise.ts. Same reshaping pattern as
 * computeNet above.
 */
function toPairwiseLedger(ledger: GeneratedLedger): PairwiseLedger {
  return {
    expenses: ledger.expenses.map((expense) => ({
      currency: expense.currency,
      payers: expense.payers,
      splits: expense.splits,
    })),
    settlements: ledger.settlements,
  };
}

function computePairwise(ledger: GeneratedLedger): PairwiseDebt[] {
  return realComputePairwise(toPairwiseLedger(ledger));
}

interface SimplifiedPayment {
  from: string;
  to: string;
  amount: bigint;
}

/** T042 implements src/lib/money/simplify.ts — greedy largest-debtor/largest-creditor matching. */
function simplify(_net: CurrencyNet): SimplifiedPayment[] {
  throw new Error("simplify is implemented by T042 — see the note above this stub");
}

/** T054 implements src/lib/money/convert.ts — re-apportions by the original amounts as weights. */
function convertExpense(_expense: GeneratedExpense, _rateBp: bigint): GeneratedExpense {
  throw new Error("convertExpense is implemented by T054 — see the note above this stub");
}

describe("balances (enabled by T040)", () => {
  it("Σ net over members == 0 for every currency", () => {
    fc.assert(
      fc.property(fc.gen(), (g) => {
        const ledger = genLedger(g);
        for (const { net } of computeNet(ledger)) {
          expect(sum(net.values())).toBe(0n);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("pairwise attribution (enabled by T041)", () => {
  it("Σ pairwise(m) == net(m) for every member, every currency", () => {
    fc.assert(
      fc.property(fc.gen(), (g) => {
        const ledger = genLedger(g);
        const nets = computeNet(ledger);
        const pairwise = computePairwise(ledger);

        for (const { currency, net } of nets) {
          for (const [member, expectedNet] of net) {
            const received = sum(
              pairwise.filter((d) => d.to === member && d.currency === currency).map((d) => d.amount),
            );
            const paid = sum(
              pairwise
                .filter((d) => d.from === member && d.currency === currency)
                .map((d) => d.amount),
            );
            expect(received - paid).toBe(expectedNet);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("debt simplification (enabled by T042)", () => {
  it.skip("preserves every member's net position", () => {
    fc.assert(
      fc.property(fc.gen(), (g) => {
        const ledger = genLedger(g);
        for (const currencyNet of computeNet(ledger)) {
          const plan = simplify(currencyNet);
          const resultingNet = new Map(currencyNet.net);
          for (const { from, to, amount } of plan) {
            resultingNet.set(from, (resultingNet.get(from) ?? 0n) + amount);
            resultingNet.set(to, (resultingNet.get(to) ?? 0n) - amount);
          }
          for (const [member, originalNet] of currencyNet.net) {
            expect(resultingNet.get(member)).toBe(originalNet);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it.skip("emits at most n-1 payments for n members with a non-zero balance", () => {
    fc.assert(
      fc.property(fc.gen(), (g) => {
        const ledger = genLedger(g);
        for (const currencyNet of computeNet(ledger)) {
          const nonZero = [...currencyNet.net.values()].filter((n) => n !== 0n).length;
          expect(simplify(currencyNet).length).toBeLessThanOrEqual(Math.max(0, nonZero - 1));
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("currency conversion (enabled by T054)", () => {
  it.skip("preserves Σ splits == total after re-apportioning at a pinned rate", () => {
    fc.assert(
      fc.property(fc.gen(), (g) => {
        const ledger = genLedger(g);
        const rateBp = g(fc.bigInt, { min: 1n, max: 1_000_000n });
        for (const expense of ledger.expenses) {
          const converted = convertExpense(expense, rateBp);
          expect(sum(converted.splits.values())).toBe(converted.total);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
