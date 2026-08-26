import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { expenses, fxRates, groupFxPins, groupMembers, users } from "../db/schema";
import type { ProviderRates, RateProvider } from "../fx/providers/types";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

function today(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function isoDatePlusDays(base: string, days: number): string {
  const date = new Date(`${base}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function fakeProvider(rates: Record<string, string>, asOf = today()): RateProvider {
  return {
    source: "open-er-api",
    fetchRates: vi.fn(
      (baseCurrency: string): Promise<ProviderRates> =>
        Promise.resolve({ baseCurrency, asOf, source: "open-er-api", rates }),
    ),
  };
}

describe.skipIf(!hasTestDatabase)("display currency and pins", () => {
  setupTestDb();

  let setDisplayCurrency: typeof import("./fx").setDisplayCurrency;
  let clearDisplayCurrency: typeof import("./fx").clearDisplayCurrency;
  let getDisplayCurrency: typeof import("./fx").getDisplayCurrency;
  let RateTooStaleError: typeof import("./fx").RateTooStaleError;
  let RateUnavailableError: typeof import("./fx").RateUnavailableError;
  let createExpense: typeof import("./expenses").createExpense;
  let createGroup: typeof import("./groups").createGroup;
  let NotAMemberError: typeof import("../auth/membership").NotAMemberError;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "false");

    ({ setDisplayCurrency, clearDisplayCurrency, getDisplayCurrency, RateTooStaleError, RateUnavailableError } =
      await import("./fx"));
    ({ createExpense } = await import("./expenses"));
    ({ createGroup } = await import("./groups"));
    ({ NotAMemberError } = await import("../auth/membership"));
  });

  afterAll(() => vi.unstubAllEnvs());
  afterEach(() => vi.restoreAllMocks());

  async function mockGetRateProvider(provider: RateProvider) {
    const providers = await import("../fx/providers");
    vi.spyOn(providers, "getRateProvider").mockReturnValue(provider);
  }

  async function seedGroupWithExpenses(currencies: string[]) {
    const db = getTestDb();
    const [owner] = await db
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Ana", passwordHash: "x" })
      .returning();
    const group = await createGroup(owner!.id, { title: "Trip" });
    for (const currency of currencies) {
      await createExpense(group.id, owner!.id, {
        title: `${currency} thing`,
        date: "2026-08-24",
        amount: currency === "COP" ? "10000" : "100",
        currency,
        split: { strategy: "equal" },
      });
    }
    return { groupId: group.id, ownerId: owner!.id };
  }

  it("writes one pin per currency present, excluding the target currency itself", async () => {
    await mockGetRateProvider(fakeProvider({ USD: "1", COP: "3062.957648", EUR: "0.856908" }));
    const { groupId, ownerId } = await seedGroupWithExpenses(["COP", "EUR", "USD"]);

    const result = await setDisplayCurrency(groupId, ownerId, "USD");

    expect(result.group.displayCurrency).toBe("USD");
    expect(result.pins.map((p) => p.fromCurrency).sort()).toEqual(["COP", "EUR"]);
    for (const pin of result.pins) expect(pin.toCurrency).toBe("USD");
  });

  it("inserting a newer fx_rates row does not change an existing pin's output — the central test of this task", async () => {
    await mockGetRateProvider(fakeProvider({ USD: "1", COP: "3062.957648" }));
    const { groupId, ownerId } = await seedGroupWithExpenses(["COP"]);
    const pinned = await setDisplayCurrency(groupId, ownerId, "USD");
    const originalRate = pinned.pins.find((p) => p.fromCurrency === "COP")!.rate;

    // Simulate tomorrow's refresh landing a very different rate.
    await getTestDb().insert(fxRates).values({
      baseCurrency: "USD",
      quoteCurrency: "COP",
      rate: "5000",
      asOf: isoDatePlusDays(today(), 1),
      source: "open-er-api",
    });

    const reread = await getDisplayCurrency(groupId, ownerId);
    expect(reread.pins.find((p) => p.fromCurrency === "COP")!.rate).toBe(originalRate);
  });

  it("DELETE then PUT the same currency reproduces the original numbers from the retained pins", async () => {
    await mockGetRateProvider(fakeProvider({ USD: "1", COP: "3062.957648" }));
    const { groupId, ownerId } = await seedGroupWithExpenses(["COP"]);
    const first = await setDisplayCurrency(groupId, ownerId, "USD");

    await clearDisplayCurrency(groupId, ownerId);
    const afterClear = await getDisplayCurrency(groupId, ownerId);
    expect(afterClear.currency).toBeNull();
    expect(afterClear.pins).toHaveLength(1); // kept, not deleted

    // Same day, same underlying (append-only) fx_rates row, so re-pinning
    // recomputes the identical cross-rate rather than merely re-reading
    // the old pin — it lands on the same numbers because the inputs
    // genuinely haven't changed.
    const second = await setDisplayCurrency(groupId, ownerId, "USD");
    expect(second.pins).toEqual(first.pins);
  });

  it("re-PUTting overwrites the existing pin row rather than conflicting or duplicating", async () => {
    const db = getTestDb();
    const { groupId, ownerId } = await seedGroupWithExpenses(["COP"]);
    // A pin already exists, as if from a much earlier PUT.
    await db.insert(groupFxPins).values({
      groupId,
      fromCurrency: "COP",
      toCurrency: "USD",
      rate: "0.0001000000",
      asOf: "2000-01-01",
      source: "open-er-api",
      pinnedBy: ownerId,
    });

    await mockGetRateProvider(fakeProvider({ USD: "1", COP: "3062.957648" }));
    const result = await setDisplayCurrency(groupId, ownerId, "USD");

    const rows = await db.select().from(groupFxPins).where(eq(groupFxPins.groupId, groupId));
    expect(rows).toHaveLength(1); // overwritten, not duplicated
    expect(rows[0]!.rate).not.toBe("0.0001000000");
    expect(result.pins[0]!.asOf).toBe(today());
  });

  it("refuses a new pin with RATE_TOO_STALE when the only stored rate is older than 7 days and the provider is down", async () => {
    const db = getTestDb();
    const { groupId, ownerId } = await seedGroupWithExpenses(["COP"]);
    await db
      .insert(fxRates)
      .values({ baseCurrency: "USD", quoteCurrency: "COP", rate: "3000", asOf: "2000-01-01", source: "open-er-api" });

    await mockGetRateProvider({
      source: "open-er-api",
      fetchRates: vi.fn().mockRejectedValue(new Error("provider down")),
    });

    await expect(setDisplayCurrency(groupId, ownerId, "USD")).rejects.toThrow(RateTooStaleError);
  });

  it("does not refuse a rate within the 7-day window even when the provider is down", async () => {
    const db = getTestDb();
    const { groupId, ownerId } = await seedGroupWithExpenses(["COP"]);
    await db.insert(fxRates).values({
      baseCurrency: "USD",
      quoteCurrency: "COP",
      rate: "3000",
      asOf: isoDatePlusDays(today(), -3),
      source: "open-er-api",
    });

    await mockGetRateProvider({
      source: "open-er-api",
      fetchRates: vi.fn().mockRejectedValue(new Error("provider down")),
    });

    const result = await setDisplayCurrency(groupId, ownerId, "USD");
    expect(result.pins).toHaveLength(1);
  });

  it("propagates an unexpected error as-is, rather than mistaking it for staleness", async () => {
    // ensureRate()'s own first findLatestRate lookup isn't wrapped in its
    // try/catch, so a raw failure there (e.g. a DB blip) reaches
    // usdRateForPin's catch already un-wrapped — it must not be treated
    // as "provider down, check for a stale fallback."
    const { groupId, ownerId } = await seedGroupWithExpenses(["COP"]);
    const boom = new Error("db connection reset");
    vi.spyOn(await import("../fx/refresh-core"), "findLatestRate").mockRejectedValue(boom);

    await expect(setDisplayCurrency(groupId, ownerId, "USD")).rejects.toThrow(boom);
  });

  it("throws RateUnavailableError when there's no stored rate at all and the provider is down", async () => {
    const { groupId, ownerId } = await seedGroupWithExpenses(["COP"]);
    await mockGetRateProvider({
      source: "open-er-api",
      fetchRates: vi.fn().mockRejectedValue(new Error("provider down")),
    });

    await expect(setDisplayCurrency(groupId, ownerId, "USD")).rejects.toThrow(RateUnavailableError);
  });

  it("an already-existing pin is never re-validated against fx_rates staleness on read", async () => {
    await mockGetRateProvider(fakeProvider({ USD: "1", COP: "3062.957648" }));
    const { groupId, ownerId } = await seedGroupWithExpenses(["COP"]);
    await setDisplayCurrency(groupId, ownerId, "USD");

    // getDisplayCurrency never touches fx_rates at all, so an aged-out
    // underlying rate can't retroactively invalidate an existing pin.
    const stillThere = await getDisplayCurrency(groupId, ownerId);
    expect(stillThere.pins).toHaveLength(1);
  });

  it("touches no expense row", async () => {
    await mockGetRateProvider(fakeProvider({ USD: "1", COP: "3062.957648" }));
    const { groupId, ownerId } = await seedGroupWithExpenses(["COP"]);
    const db = getTestDb();
    const before = await db.select().from(expenses).where(eq(expenses.groupId, groupId));

    await setDisplayCurrency(groupId, ownerId, "USD");

    const after = await db.select().from(expenses).where(eq(expenses.groupId, groupId));
    expect(after).toEqual(before);
  });

  it("404s a non-member", async () => {
    const { groupId } = await seedGroupWithExpenses(["COP"]);
    await expect(setDisplayCurrency(groupId, crypto.randomUUID(), "USD")).rejects.toThrow(NotAMemberError);
    await expect(clearDisplayCurrency(groupId, crypto.randomUUID())).rejects.toThrow(NotAMemberError);
    await expect(getDisplayCurrency(groupId, crypto.randomUUID())).rejects.toThrow(NotAMemberError);
  });

  it("a group with no live activity yet gets zero pins", async () => {
    const db = getTestDb();
    const [owner] = await db
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Ana", passwordHash: "x" })
      .returning();
    const group = await createGroup(owner!.id, { title: "Empty" });

    const result = await setDisplayCurrency(group.id, owner!.id, "USD");
    expect(result.pins).toEqual([]);
  });

  it("only counts currencies with live activity, not members with none", async () => {
    const db = getTestDb();
    await mockGetRateProvider(fakeProvider({ USD: "1", COP: "3062.957648" }));
    const { groupId, ownerId } = await seedGroupWithExpenses(["COP"]);
    const [extra] = await db
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Beto", passwordHash: "x" })
      .returning();
    await db.insert(groupMembers).values({ groupId, userId: extra!.id, role: "member" });

    const result = await setDisplayCurrency(groupId, ownerId, "USD");
    expect(result.pins.map((p) => p.fromCurrency)).toEqual(["COP"]);
  });
});
