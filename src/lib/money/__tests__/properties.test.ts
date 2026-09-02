import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeBalances, type Ledger, type LedgerEntry } from "../balances";
import { convertExpenseAmounts } from "../convert";
import {
  computePairwise as realComputePairwise,
  type PairwiseLedger,
} from "../pairwise";
import { perMemberBreakdown } from "../insights";
import { explainSimplifiedPlan, simplify as realSimplify } from "../simplify";
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

/**
 * T042 implemented src/lib/money/simplify.ts. Same reshaping pattern as
 * computeNet/computePairwise above.
 */
function simplify(currencyNet: CurrencyNet): SimplifiedPayment[] {
  return realSimplify(currencyNet.net);
}

/**
 * T054 implemented `convertExpenseAmounts` in src/lib/money/convert.ts —
 * re-apportions by the original amounts as weights. Every generated
 * expense currency (COP, USD, EUR) is exponent 2 (currency.md § Supported
 * currencies), so the exponent-asymmetry path is exercised separately in
 * convert.test.ts's own unit tests, not here; this property is about the
 * apportionment invariant surviving conversion at an arbitrary rate, not
 * about exponent handling.
 */
function convertExpense(expense: GeneratedExpense, rateScaled: bigint): GeneratedExpense {
  const converted = convertExpenseAmounts(
    { total: expense.total, payers: expense.payers, splits: expense.splits },
    rateScaled,
    2,
    2,
    expense.id,
  );
  return { ...expense, ...converted };
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
  it("preserves every member's net position", () => {
    fc.assert(
      fc.property(fc.gen(), (g) => {
        const ledger = genLedger(g);
        for (const currencyNet of computeNet(ledger)) {
          const plan = simplify(currencyNet);
          // Re-derive net *from the plan itself* (paid in − paid out) and
          // compare against the net that went in — simplification only
          // re-routes who pays whom, so the two must match exactly. This
          // is not the same as applying the plan as real settlements on
          // top of the existing net, which would drive everyone to zero.
          const derivedNet = new Map([...currencyNet.net.keys()].map((id) => [id, 0n]));
          for (const { from, to, amount } of plan) {
            derivedNet.set(from, (derivedNet.get(from) ?? 0n) - amount);
            derivedNet.set(to, (derivedNet.get(to) ?? 0n) + amount);
          }
          for (const [member, originalNet] of currencyNet.net) {
            expect(derivedNet.get(member) ?? 0n).toBe(originalNet);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("emits at most n-1 payments for n members with a non-zero balance", () => {
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

  it("explainSimplifiedPlan never fabricates a debt or drops an edge", () => {
    fc.assert(
      fc.property(fc.gen(), (g) => {
        const ledger = genLedger(g);
        const allRaw = computePairwise(ledger);
        for (const currencyNet of computeNet(ledger)) {
          const plan = simplify(currencyNet);
          const raw = allRaw.filter((d) => d.currency === currencyNet.currency);
          const explained = explainSimplifiedPlan(plan, raw);

          expect(explained.map(({ from, to, amount }) => ({ from, to, amount }))).toEqual(plan);
          for (const edge of explained) {
            for (const cited of edge.explains) {
              expect(cited.amount > 0n).toBe(true);
              expect(raw).toContainEqual(
                expect.objectContaining({ from: cited.from, to: cited.to, currency: cited.currency }),
              );
            }
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("currency conversion (enabled by T054)", () => {
  it("preserves Σ splits == total and Σ payers == total after re-apportioning at a pinned rate", () => {
    fc.assert(
      fc.property(fc.gen(), (g) => {
        const ledger = genLedger(g);
        // Spans far below and far above RATE_SCALE_FACTOR on purpose, the
        // same reason genTotal spans tiny to huge: the low end is where a
        // converted total can legitimately round all the way to zero, the
        // high end stresses the same bigint arithmetic at scale.
        const rateScaled = g(fc.bigInt, { min: 1n, max: 10n ** 15n });
        for (const expense of ledger.expenses) {
          const converted = convertExpense(expense, rateScaled);
          expect(sum(converted.splits.values())).toBe(converted.total);
          expect(sum(converted.payers.values())).toBe(converted.total);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

/**
 * T082 added `perMemberBreakdown` — a read-side reshape of `computeBalances`
 * into paid / consumed / expenseContribution / sent / received / currentNet
 * per member per currency. These check that reshape never diverges from the
 * balance engine, and that the paid/consumed/total identity holds.
 */
function totalsByCurrency(ledger: GeneratedLedger): Map<string, bigint> {
  const totals = new Map<string, bigint>();
  for (const expense of ledger.expenses) {
    totals.set(expense.currency, (totals.get(expense.currency) ?? 0n) + expense.total);
  }
  return totals;
}

describe("per-member breakdown (enabled by T082)", () => {
  it("Σ paid == Σ consumed == Σ expense totals, per currency", () => {
    fc.assert(
      fc.property(fc.gen(), (g) => {
        const ledger = genLedger(g);
        const breakdown = perMemberBreakdown(toLedgerInput(ledger));
        const totals = totalsByCurrency(ledger);

        for (const [currency, rows] of breakdown) {
          const paid = sum(rows.map((r) => r.paid));
          expect(paid).toBe(sum(rows.map((r) => r.consumed)));
          expect(paid).toBe(totals.get(currency) ?? 0n);
        }
        for (const [currency, total] of totals) {
          if (total > 0n) expect(breakdown.has(currency)).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("currentNet matches the balance engine, sums to 0, and its parts reconcile", () => {
    fc.assert(
      fc.property(fc.gen(), (g) => {
        const ledger = genLedger(g);
        const breakdown = perMemberBreakdown(toLedgerInput(ledger));
        const nets = computeNet(ledger);

        for (const [currency, rows] of breakdown) {
          expect(sum(rows.map((r) => r.currentNet))).toBe(0n);
          const engineNet = nets.find((n) => n.currency === currency)!.net;
          for (const row of rows) {
            expect(row.currentNet).toBe(engineNet.get(row.userId) ?? 0n);
            expect(row.expenseContribution).toBe(row.paid - row.consumed);
            expect(row.currentNet).toBe(row.expenseContribution + row.sent - row.received);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("still balances after every expense is converted at a pinned rate", () => {
    fc.assert(
      fc.property(fc.gen(), (g) => {
        const ledger = genLedger(g);
        const rateScaled = g(fc.bigInt, { min: 1n, max: 10n ** 15n });
        const convertedLedger: GeneratedLedger = {
          ...ledger,
          expenses: ledger.expenses.map((expense) => convertExpense(expense, rateScaled)),
        };
        // computeBalances (inside perMemberBreakdown) throws unless Σ net == 0;
        // reaching here at all means the converted ledger still balances.
        const breakdown = perMemberBreakdown(toLedgerInput(convertedLedger));
        for (const [, rows] of breakdown) {
          expect(sum(rows.map((r) => r.paid))).toBe(sum(rows.map((r) => r.consumed)));
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
