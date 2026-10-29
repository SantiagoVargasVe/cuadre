import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../test/db";
import { expenses, fxRates, groupMembers, users } from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("GTQ trip ledger", () => {
  setupTestDb();

  let createGroup: typeof import("./groups").createGroup;
  let createExpense: typeof import("./expenses").createExpense;
  let createSettlement: typeof import("./settlements").createSettlement;
  let getBalancesView: typeof import("./balances").getBalancesView;
  let setDisplayCurrency: typeof import("./fx").setDisplayCurrency;
  let clearDisplayCurrency: typeof import("./fx").clearDisplayCurrency;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR,GTQ");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "false");
    ({ createGroup } = await import("./groups"));
    ({ createExpense } = await import("./expenses"));
    ({ createSettlement } = await import("./settlements"));
    ({ getBalancesView } = await import("./balances"));
    ({ setDisplayCurrency, clearDisplayCurrency } = await import("./fx"));
  });
  afterAll(() => vi.unstubAllEnvs());

  async function trip() {
    const members = await getTestDb().insert(users).values(
      ["Ana", "Beto", "Caro", "Dani"].map((displayName) => ({
        email: `${crypto.randomUUID()}@example.com`, displayName, passwordHash: "x",
      })),
    ).returning();
    const owner = members[0]!.id;
    const group = await createGroup(owner, { title: "Guatemala", defaultCurrency: "GTQ" });
    await getTestDb().insert(groupMembers).values(
      members.slice(1).map(({ id }) => ({ groupId: group.id, userId: id, role: "member" as const })),
    );
    await createExpense(group.id, owner, {
      title: "Cena", date: "2026-10-28", currency: "GTQ", amount: "8000",
      paidBy: [{ userId: owner, amount: "8000" }], split: { strategy: "equal" },
    });
    return { group, owner, friend: members[1]!.id };
  }

  it("creates a GTQ group, splits centavos and records a GTQ settlement", async () => {
    const { group, owner, friend } = await trip();
    expect(group.defaultCurrency).toBe("GTQ");
    const payment = await createSettlement(group.id, friend, {
      toUserId: owner, amount: "1001", currency: "GTQ", settledOn: "2026-10-28",
    });
    expect(payment).toMatchObject({ amount: "1001", currency: "GTQ" });
    const view = await getBalancesView(group.id, owner, {});
    expect(view.byCurrency).toHaveLength(1);
    expect(view.byCurrency[0]).toMatchObject({ currency: "GTQ" });
    expect(view.byCurrency[0]!.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: owner, net: "4999" }),
      expect.objectContaining({ userId: friend, net: "-999" }),
    ]));
    expect(view.byCurrency[0]!.members.reduce((sum, member) => sum + BigInt(member.net), 0n)).toBe(0n);
  });

  it.each(["GTQ", "USD"])("converts mixed GTQ/USD expenses to %s and reverses without changing originals", async (target) => {
    const { group, owner } = await trip();
    await createExpense(group.id, owner, {
      title: "Tour", date: "2026-10-28", currency: "USD", amount: "1000",
      paidBy: [{ userId: owner, amount: "1000" }], split: { strategy: "equal" },
    });
    // Deterministic test rate, not a live quote: USD 1 = GTQ 8.
    await getTestDb().insert(fxRates).values({
      baseCurrency: "USD", quoteCurrency: "GTQ", rate: "8",
      asOf: new Date().toISOString().slice(0, 10), source: "open-er-api",
    });
    const original = await getBalancesView(group.id, owner, {});
    expect(original.byCurrency.map(({ currency }) => currency).sort()).toEqual(["GTQ", "USD"]);

    const converted = await setDisplayCurrency(group.id, owner, target);
    expect(converted.pins).toEqual([expect.objectContaining({
      fromCurrency: target === "GTQ" ? "USD" : "GTQ", toCurrency: target,
      rate: target === "GTQ" ? "8.0000000000" : "0.1250000000",
    })]);
    const view = await getBalancesView(group.id, owner, {});
    expect(view.displayCurrency).toBe(target);
    expect(view.byCurrency).toHaveLength(1);
    expect(view.byCurrency[0]!.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: owner, net: target === "GTQ" ? "12000" : "1500" }),
    ]));
    expect(view.byCurrency[0]!.members.reduce((sum, member) => sum + BigInt(member.net), 0n)).toBe(0n);
    const stored = await getTestDb().select().from(expenses).where(eq(expenses.groupId, group.id));
    expect(stored).toEqual(expect.arrayContaining([
      expect.objectContaining({ currency: "GTQ", totalAmount: 8000n }),
      expect.objectContaining({ currency: "USD", totalAmount: 1000n }),
    ]));
    await clearDisplayCurrency(group.id, owner);
    expect(await getBalancesView(group.id, owner, {})).toEqual(original);
  });
});
