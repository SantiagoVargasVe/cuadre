import { describe, expect, it } from "vitest";
import { diffSnapshots, parseSnapshot } from "./expense-revision-diff";

const ana = "ana";
const beto = "beto";
const caro = "caro";

function snapshot(overrides: Record<string, unknown> = {}) {
  return parseSnapshot({
    title: "Cena",
    expenseDate: "2026-08-24",
    totalAmount: "1000",
    currency: "COP",
    splitStrategy: "equal",
    payers: [{ userId: ana, amount: "1000" }],
    splits: [{ userId: ana, amount: "500" }, { userId: beto, amount: "500" }],
    ...overrides,
  })!;
}

describe("diffSnapshots", () => {
  it("returns exactly one field change for a title-only edit", () => {
    const changes = diffSnapshots(snapshot(), snapshot({ title: "Cena frente al mar" }), () => null);
    expect(changes).toEqual([{ kind: "text", field: "title", from: "Cena", to: "Cena frente al mar" }]);
  });

  it("lists each split member delta and keeps diff money as bigint", () => {
    const changes = diffSnapshots(
      snapshot(),
      snapshot({
        splits: [{ userId: ana, amount: "400" }, { userId: caro, amount: "600" }],
      }),
      (id) => ({ [ana]: "Ana", [beto]: "Beto", [caro]: "Caro" })[id] ?? null,
    );
    const splits = changes.filter((change) => change.kind === "party" && change.field === "splits");

    expect(splits).toEqual([
      expect.objectContaining({ userId: ana, change: "changed", from: { amount: 500n, currency: "COP" }, to: { amount: 400n, currency: "COP" } }),
      expect.objectContaining({ userId: beto, change: "removed", from: { amount: 500n, currency: "COP" }, to: null }),
      expect.objectContaining({ userId: caro, change: "added", from: null, to: { amount: 600n, currency: "COP" } }),
    ]);
  });

  it("records a multi-payer edit per member", () => {
    const changes = diffSnapshots(
      snapshot(),
      snapshot({ payers: [{ userId: ana, amount: "400" }, { userId: beto, amount: "600" }] }),
      (id) => ({ [ana]: "Ana", [beto]: "Beto" })[id] ?? null,
    );
    const payers = changes.filter((change) => change.kind === "party" && change.field === "payers");

    expect(payers).toEqual([
      expect.objectContaining({ userId: ana, change: "changed", from: { amount: 1000n, currency: "COP" }, to: { amount: 400n, currency: "COP" } }),
      expect.objectContaining({ userId: beto, change: "added", from: null, to: { amount: 600n, currency: "COP" } }),
    ]);
  });

  it("reports a total-amount change as money, keeping both sides bigint", () => {
    const changes = diffSnapshots(snapshot(), snapshot({ totalAmount: "1500" }), () => null);
    expect(changes).toEqual([
      { kind: "money", field: "totalAmount", from: { amount: 1000n, currency: "COP" }, to: { amount: 1500n, currency: "COP" } },
    ]);
    const [change] = changes;
    if (change?.kind !== "money") throw new Error("expected a money change");
    expect(typeof change.from.amount).toBe("bigint");
    expect(typeof change.to.amount).toBe("bigint");
  });

  it("renders each side of a currency change in its own currency", () => {
    const changes = diffSnapshots(
      snapshot(),
      snapshot({ currency: "USD" }),
      (id) => ({ [ana]: "Ana", [beto]: "Beto" })[id] ?? null,
    );

    expect(changes).toContainEqual({ kind: "text", field: "currency", from: "COP", to: "USD" });
    expect(changes).toContainEqual({
      kind: "money",
      field: "totalAmount",
      from: { amount: 1000n, currency: "COP" },
      to: { amount: 1000n, currency: "USD" },
    });
    // Each party delta keeps its own side's currency rather than assuming one.
    const anaSplit = changes.find((c) => c.kind === "party" && c.field === "splits" && c.userId === ana);
    expect(anaSplit).toMatchObject({ from: { currency: "COP" }, to: { currency: "USD" } });
  });

  it("reports a date-only edit as a single text change", () => {
    const changes = diffSnapshots(snapshot(), snapshot({ expenseDate: "2026-08-25" }), () => null);
    expect(changes).toEqual([{ kind: "text", field: "expenseDate", from: "2026-08-24", to: "2026-08-25" }]);
  });

  it("reports a split-strategy change as a single text change", () => {
    const changes = diffSnapshots(snapshot(), snapshot({ splitStrategy: "exact" }), () => null);
    expect(changes).toEqual([{ kind: "text", field: "splitStrategy", from: "equal", to: "exact" }]);
  });

  it("returns no changes for identical consecutive snapshots", () => {
    expect(diffSnapshots(snapshot(), snapshot(), () => null)).toEqual([]);
  });

  it("never diffs against a missing snapshot — the created/deleted no-diff path", () => {
    expect(diffSnapshots(null, snapshot(), () => null)).toEqual([]);
    expect(diffSnapshots(snapshot(), null, () => null)).toEqual([]);
  });

  it("strips unknown snapshot fields before the diff can expose them", () => {
    const parsed = parseSnapshot({ ...snapshot(), email: "private@example.com" });
    expect(parsed).not.toHaveProperty("email");
  });

  it("returns null for a snapshot that is not an object", () => {
    expect(parseSnapshot("nope")).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
  });
});
