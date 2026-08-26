import { describe, expect, it } from "vitest";
import { computeBalances, type Ledger } from "./balances";
import { UnbalancedLedgerError } from "./errors";

function emptyLedger(): Ledger {
  return { paid: [], owed: [], sent: [], received: [] };
}

describe("computeBalances", () => {
  it("a single expense split three ways: one payer, three owers", () => {
    const ledger: Ledger = {
      ...emptyLedger(),
      paid: [{ currency: "COP", memberId: "ana", amount: 9000n }],
      owed: [
        { currency: "COP", memberId: "ana", amount: 3000n },
        { currency: "COP", memberId: "beto", amount: 3000n },
        { currency: "COP", memberId: "caro", amount: 3000n },
      ],
    };

    const result = computeBalances(ledger);
    const cop = result.get("COP")!;
    expect(cop.get("ana")!.net).toBe(6000n);
    expect(cop.get("beto")!.net).toBe(-3000n);
    expect(cop.get("caro")!.net).toBe(-3000n);
  });

  it("multi-payer: two people cover one expense", () => {
    const ledger: Ledger = {
      ...emptyLedger(),
      paid: [
        { currency: "COP", memberId: "ana", amount: 6000n },
        { currency: "COP", memberId: "beto", amount: 4000n },
      ],
      owed: [
        { currency: "COP", memberId: "ana", amount: 5000n },
        { currency: "COP", memberId: "beto", amount: 5000n },
      ],
    };

    const result = computeBalances(ledger);
    const cop = result.get("COP")!;
    expect(cop.get("ana")!.net).toBe(1000n);
    expect(cop.get("beto")!.net).toBe(-1000n);
  });

  it("a settlement clears a debt exactly", () => {
    const ledger: Ledger = {
      ...emptyLedger(),
      paid: [{ currency: "COP", memberId: "ana", amount: 10000n }],
      owed: [
        { currency: "COP", memberId: "ana", amount: 5000n },
        { currency: "COP", memberId: "beto", amount: 5000n },
      ],
      sent: [{ currency: "COP", memberId: "beto", amount: 5000n }],
      received: [{ currency: "COP", memberId: "ana", amount: 5000n }],
    };

    const result = computeBalances(ledger);
    const cop = result.get("COP")!;
    expect(cop.get("ana")!.net).toBe(0n);
    expect(cop.get("beto")!.net).toBe(0n);
  });

  it("a settlement overshooting a debt flips the sign", () => {
    const ledger: Ledger = {
      ...emptyLedger(),
      paid: [{ currency: "COP", memberId: "ana", amount: 10000n }],
      owed: [
        { currency: "COP", memberId: "ana", amount: 5000n },
        { currency: "COP", memberId: "beto", amount: 5000n },
      ],
      // Beto owes 5000 but pays a round 8000.
      sent: [{ currency: "COP", memberId: "beto", amount: 8000n }],
      received: [{ currency: "COP", memberId: "ana", amount: 8000n }],
    };

    const result = computeBalances(ledger);
    const cop = result.get("COP")!;
    expect(cop.get("ana")!.net).toBe(-3000n); // now owes Beto 3000
    expect(cop.get("beto")!.net).toBe(3000n); // is owed 3000
  });

  it("a mixed-currency group produces two independent position sets", () => {
    const ledger: Ledger = {
      paid: [
        { currency: "COP", memberId: "ana", amount: 10000n },
        { currency: "USD", memberId: "beto", amount: 100n },
      ],
      owed: [
        { currency: "COP", memberId: "ana", amount: 5000n },
        { currency: "COP", memberId: "beto", amount: 5000n },
        { currency: "USD", memberId: "ana", amount: 50n },
        { currency: "USD", memberId: "beto", amount: 50n },
      ],
      sent: [],
      received: [],
    };

    const result = computeBalances(ledger);
    expect(result.get("COP")!.get("ana")!.net).toBe(5000n);
    expect(result.get("COP")!.get("beto")!.net).toBe(-5000n);
    expect(result.get("USD")!.get("ana")!.net).toBe(-50n);
    expect(result.get("USD")!.get("beto")!.net).toBe(50n);
    // Ana is up in COP and down in USD — never summed into one number.
    expect(result.get("COP")!.get("ana")).not.toBe(result.get("USD")!.get("ana"));
  });

  it("Σ net == 0 holds for every currency, always", () => {
    const ledger: Ledger = {
      paid: [
        { currency: "COP", memberId: "a", amount: 1n },
        { currency: "COP", memberId: "b", amount: 2n },
        { currency: "COP", memberId: "c", amount: 3n },
      ],
      owed: [
        { currency: "COP", memberId: "a", amount: 2n },
        { currency: "COP", memberId: "b", amount: 2n },
        { currency: "COP", memberId: "c", amount: 2n },
      ],
      sent: [],
      received: [],
    };
    const result = computeBalances(ledger);
    let total = 0n;
    for (const balance of result.get("COP")!.values()) total += balance.net;
    expect(total).toBe(0n);
  });

  it("throws UnbalancedLedgerError when Σ net != 0, naming the currency and the sum", () => {
    const ledger: Ledger = {
      ...emptyLedger(),
      paid: [{ currency: "COP", memberId: "ana", amount: 100n }],
      owed: [{ currency: "COP", memberId: "beto", amount: 50n }], // 50 units vanish
    };

    const error = (() => {
      try {
        computeBalances(ledger);
      } catch (caught) {
        return caught as UnbalancedLedgerError;
      }
      throw new Error("expected a throw");
    })();
    expect(error).toBeInstanceOf(UnbalancedLedgerError);
    expect(error.currency).toBe("COP");
    expect(error.netSum).toBe(50n);
  });

  it("an empty ledger produces no currencies at all", () => {
    expect(computeBalances(emptyLedger()).size).toBe(0);
  });

  it("a removed member's historical rows still contribute", () => {
    // No membership concept here at all — computeBalances only ever sees
    // ledger rows, so a member no longer in the group still nets out
    // correctly as long as their historical contributions are passed in.
    const ledger: Ledger = {
      ...emptyLedger(),
      paid: [{ currency: "COP", memberId: "removed-member", amount: 1000n }],
      owed: [{ currency: "COP", memberId: "still-here", amount: 1000n }],
    };
    const result = computeBalances(ledger);
    expect(result.get("COP")!.get("removed-member")!.net).toBe(1000n);
  });
});
