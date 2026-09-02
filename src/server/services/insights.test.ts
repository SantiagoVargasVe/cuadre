import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { groupMembers, groups, users } from "../db/schema";
import type { ProviderRates, RateProvider } from "../fx/providers/types";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

function fakeProvider(rates: Record<string, string>): RateProvider {
  const now = new Date();
  const asOf = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  return {
    source: "open-er-api",
    fetchRates: (baseCurrency: string): Promise<ProviderRates> =>
      Promise.resolve({ baseCurrency, asOf, source: "open-er-api", rates }),
  };
}

describe.skipIf(!hasTestDatabase)("getInsights", () => {
  setupTestDb();

  let getInsights: typeof import("./insights").getInsights;
  let createExpense: typeof import("./expenses").createExpense;
  let deleteExpense: typeof import("./expenses").deleteExpense;
  let createSettlement: typeof import("./settlements").createSettlement;
  let setDisplayCurrency: typeof import("./fx").setDisplayCurrency;
  let RateUnavailableError: typeof import("./fx").RateUnavailableError;
  let getGroupBalances: typeof import("./balances").getGroupBalances;
  let getBalancesView: typeof import("./balances").getBalancesView;
  let NotAMemberError: typeof import("../auth/membership").NotAMemberError;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ getInsights } = await import("./insights"));
    ({ createExpense, deleteExpense } = await import("./expenses"));
    ({ createSettlement } = await import("./settlements"));
    ({ setDisplayCurrency, RateUnavailableError } = await import("./fx"));
    ({ getGroupBalances, getBalancesView } = await import("./balances"));
    ({ NotAMemberError } = await import("../auth/membership"));
  });

  afterAll(() => vi.unstubAllEnvs());

  async function mockProvider(rates: Record<string, string>) {
    const providers = await import("../fx/providers");
    vi.spyOn(providers, "getRateProvider").mockReturnValue(fakeProvider(rates));
  }

  async function seedGroup(names: string[]) {
    const db = getTestDb();
    const memberIds: string[] = [];
    for (const displayName of names) {
      const [user] = await db
        .insert(users)
        .values({ email: `${crypto.randomUUID()}@example.com`, displayName, passwordHash: "x" })
        .returning();
      memberIds.push(user!.id);
    }
    const [group] = await db
      .insert(groups)
      .values({ title: "Trip", defaultCurrency: "COP", createdBy: memberIds[0]! })
      .returning();
    await db.insert(groupMembers).values(
      memberIds.map((userId, index) => ({
        groupId: group!.id,
        userId,
        role: index === 0 ? ("owner" as const) : ("member" as const),
      })),
    );
    return { groupId: group!.id, memberIds };
  }

  const equal = { split: { strategy: "equal" as const } };

  it("404s a non-member and a removed member", async () => {
    const { groupId, memberIds } = await seedGroup(["Ana", "Beto"]);
    const [outsider] = await getTestDb()
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Nadie", passwordHash: "x" })
      .returning();

    await expect(getInsights(groupId, outsider!.id)).rejects.toThrow(NotAMemberError);

    await getTestDb()
      .update(groupMembers)
      .set({ removedAt: new Date() })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberIds[1]!)));
    await expect(getInsights(groupId, memberIds[1]!)).rejects.toThrow(NotAMemberError);
  });

  it("returns nothing for an empty group", async () => {
    const { groupId, memberIds } = await seedGroup(["Ana"]);
    expect(await getInsights(groupId, memberIds[0]!)).toEqual({ displayCurrency: null, byCurrency: [] });
  });

  it("aggregates by day, month, and category, plus the per-member breakdown", async () => {
    const { groupId, memberIds } = await seedGroup(["Ana", "Beto"]);
    const [ana, beto] = memberIds as [string, string];
    await createExpense(groupId, ana, { title: "Cena", date: "2026-08-24", amount: "30000", currency: "COP", category: "comida", ...equal });
    await createExpense(groupId, ana, { title: "Taxi", date: "2026-08-24", amount: "10000", currency: "COP", category: "transporte", ...equal });
    await createExpense(groupId, ana, { title: "Hotel", date: "2026-09-02", amount: "80000", currency: "COP", category: "alojamiento", ...equal });

    const { byCurrency } = await getInsights(groupId, ana);
    const cop = byCurrency.find((block) => block.currency === "COP")!;
    expect(cop.byDay).toEqual([
      { key: "2026-08-24", amount: "40000" },
      { key: "2026-09-02", amount: "80000" },
    ]);
    expect(cop.byMonth).toEqual([
      { key: "2026-08", amount: "40000" },
      { key: "2026-09", amount: "80000" },
    ]);
    expect(cop.byCategory).toEqual([
      { category: "alojamiento", amount: "80000" },
      { category: "comida", amount: "30000" },
      { category: "transporte", amount: "10000" },
    ]);
    // Ana created all three (paid 120000), 120000 split equally → 60000 each consumed.
    expect(cop.members).toEqual([
      { userId: ana, paid: "120000", consumed: "60000", expenseContribution: "60000", sent: "0", received: "0", currentNet: "60000" },
      { userId: beto, paid: "0", consumed: "60000", expenseContribution: "-60000", sent: "0", received: "0", currentNet: "-60000" },
    ]);
    expect(cop.pins).toBeUndefined();
  });

  it("keeps uncategorised spend in its own bucket", async () => {
    const { groupId, memberIds } = await seedGroup(["Ana"]);
    await createExpense(groupId, memberIds[0]!, { title: "Sin cat", date: "2026-08-24", amount: "5000", currency: "COP", ...equal });
    await createExpense(groupId, memberIds[0]!, { title: "Otro", date: "2026-08-24", amount: "1000", currency: "COP", category: "otro", ...equal });

    const { byCurrency } = await getInsights(groupId, memberIds[0]!);
    expect(byCurrency[0]!.byCategory).toEqual([
      { category: null, amount: "5000" },
      { category: "otro", amount: "1000" },
    ]);
  });

  it("returns one block per currency and never a combined total", async () => {
    const { groupId, memberIds } = await seedGroup(["Ana"]);
    await createExpense(groupId, memberIds[0]!, { title: "COP", date: "2026-08-24", amount: "30000", currency: "COP", ...equal });
    await createExpense(groupId, memberIds[0]!, { title: "USD", date: "2026-08-24", amount: "800", currency: "USD", ...equal });

    const { byCurrency } = await getInsights(groupId, memberIds[0]!);
    expect(byCurrency.map((block) => block.currency)).toEqual(["COP", "USD"]);
    expect(byCurrency.find((b) => b.currency === "COP")!.byDay).toEqual([{ key: "2026-08-24", amount: "30000" }]);
    expect(byCurrency.find((b) => b.currency === "USD")!.byDay).toEqual([{ key: "2026-08-24", amount: "800" }]);
  });

  it("excludes settlements and soft-deleted expenses", async () => {
    const { groupId, memberIds } = await seedGroup(["Ana", "Beto"]);
    const [ana, beto] = memberIds as [string, string];
    await createExpense(groupId, ana, { title: "Cuenta", date: "2026-08-24", amount: "20000", currency: "COP", category: "comida", ...equal });
    const doomed = await createExpense(groupId, ana, { title: "Borrar", date: "2026-08-24", amount: "9999", currency: "COP", ...equal });
    await deleteExpense(doomed.id, ana);
    await createSettlement(groupId, beto, { toUserId: ana, amount: "5000", currency: "COP", settledOn: "2026-08-25" });

    const { byCurrency } = await getInsights(groupId, ana);
    expect(byCurrency[0]!.byDay).toEqual([{ key: "2026-08-24", amount: "20000" }]);
    expect(byCurrency[0]!.byCategory).toEqual([{ category: "comida", amount: "20000" }]);
  });

  it("converts and labels the block when a display currency is pinned", async () => {
    await mockProvider({ COP: "4000", EUR: "0.9" }); // 1 USD = 4000 COP
    const { groupId, memberIds } = await seedGroup(["Ana"]);
    await createExpense(groupId, memberIds[0]!, { title: "Grande", date: "2026-08-24", amount: "120000000", currency: "COP", ...equal });
    await setDisplayCurrency(groupId, memberIds[0]!, "USD");

    const result = await getInsights(groupId, memberIds[0]!);
    expect(result.displayCurrency).toBe("USD");
    expect(result.byCurrency).toHaveLength(1);
    const block = result.byCurrency[0]!;
    expect(block.currency).toBe("USD");
    expect(block.pins!.length).toBeGreaterThan(0);
    // 1,200,000 COP ÷ 4000 = 300 USD = 30000 minor units.
    expect(block.byDay).toEqual([{ key: "2026-08-24", amount: "30000" }]);
    expect(block.members).toEqual([
      { userId: memberIds[0]!, paid: "30000", consumed: "30000", expenseContribution: "0", sent: "0", received: "0", currentNet: "0" },
    ]);
  });

  it("is RATE_UNAVAILABLE when a currency appears after the group pinned", async () => {
    await mockProvider({ COP: "4000", EUR: "0.9" });
    const { groupId, memberIds } = await seedGroup(["Ana"]);
    await createExpense(groupId, memberIds[0]!, { title: "COP", date: "2026-08-24", amount: "40000", currency: "COP", ...equal });
    await setDisplayCurrency(groupId, memberIds[0]!, "COP");
    await createExpense(groupId, memberIds[0]!, { title: "USD nuevo", date: "2026-08-25", amount: "500", currency: "USD", ...equal });

    await expect(getInsights(groupId, memberIds[0]!)).rejects.toThrow(RateUnavailableError);
  });

  function memberRow(
    block: Awaited<ReturnType<typeof getInsights>>["byCurrency"][number],
    userId: string,
  ) {
    return block.members.find((row) => row.userId === userId)!;
  }

  it("separates expenseContribution from currentNet once a settlement is recorded, and currentNet matches balances", async () => {
    const { groupId, memberIds } = await seedGroup(["Ana", "Beto"]);
    const [ana, beto] = memberIds as [string, string];
    await createExpense(groupId, ana, {
      title: "Cuenta", date: "2026-08-24", amount: "20000", currency: "COP",
      paidBy: [{ userId: ana, amount: "20000" }], ...equal,
    });
    await createSettlement(groupId, beto, { toUserId: ana, amount: "10000", currency: "COP", settledOn: "2026-08-25" });

    const [block] = (await getInsights(groupId, ana)).byCurrency;
    const row = memberRow(block!, ana);
    expect(row.expenseContribution).toBe("10000"); // paid 20000 − consumed 10000
    expect(row.currentNet).toBe("0"); // ...then received the 10000 settlement

    const balances = await getGroupBalances(groupId, ana);
    for (const r of block!.members) {
      expect(r.currentNet).toBe((balances.get("COP")!.get(r.userId)?.net ?? 0n).toString());
    }
    expect(block!.members.reduce((sum, r) => sum + BigInt(r.currentNet), 0n)).toBe(0n);
  });

  it("attributes a multi-payer expense and a loan to each member", async () => {
    const { groupId, memberIds } = await seedGroup(["Ana", "Beto"]);
    const [ana, beto] = memberIds as [string, string];
    await createExpense(groupId, ana, {
      title: "Compartido", date: "2026-08-24", amount: "30000", currency: "COP",
      paidBy: [{ userId: ana, amount: "20000" }, { userId: beto, amount: "10000" }], ...equal,
    });
    await createExpense(groupId, ana, {
      title: "Préstamo", date: "2026-08-25", amount: "5000", currency: "COP",
      paidBy: [{ userId: ana, amount: "5000" }], split: { strategy: "loan", to: beto },
    });

    const [block] = (await getInsights(groupId, ana)).byCurrency;
    expect(memberRow(block!, ana)).toMatchObject({ paid: "25000", consumed: "15000", expenseContribution: "10000" });
    expect(memberRow(block!, beto)).toMatchObject({ paid: "10000", consumed: "20000", expenseContribution: "-10000" });
  });

  it("shows a current member with no activity as an honest zero row", async () => {
    const { groupId, memberIds } = await seedGroup(["Ana", "Beto", "Caro"]);
    const [ana] = memberIds as [string, string, string];
    await createExpense(groupId, ana, {
      title: "Solo Ana", date: "2026-08-24", amount: "1000", currency: "COP",
      split: { strategy: "equal_subset", members: [ana] },
    });

    const [block] = (await getInsights(groupId, ana)).byCurrency;
    expect(block!.members).toHaveLength(3);
    for (const other of memberIds.slice(1)) {
      expect(memberRow(block!, other)).toMatchObject({ paid: "0", consumed: "0", currentNet: "0" });
    }
  });

  it("per-member currentNet agrees with converted balances to the minor unit", async () => {
    await mockProvider({ COP: "3800", EUR: "0.9" });
    const { groupId, memberIds } = await seedGroup(["Ana", "Beto"]);
    const [ana, beto] = memberIds as [string, string];
    await createExpense(groupId, ana, {
      title: "Cena", date: "2026-08-24", amount: "97531", currency: "COP",
      paidBy: [{ userId: ana, amount: "97531" }],
      split: { strategy: "shares", weights: { [ana]: 2, [beto]: 1 } },
    });
    await setDisplayCurrency(groupId, ana, "USD");

    const [block] = (await getInsights(groupId, ana)).byCurrency;
    const view = await getBalancesView(groupId, ana, {});
    const balanceBlock = view.byCurrency.find((b) => b.currency === "USD")!;
    for (const row of block!.members) {
      const balanceNet = balanceBlock.members.find((m) => m.userId === row.userId)?.net ?? "0";
      expect(row.currentNet).toBe(balanceNet);
    }
    expect(block!.members.reduce((sum, r) => sum + BigInt(r.currentNet), 0n)).toBe(0n);
  });
});
