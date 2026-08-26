import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { fxRates, groupFxPins, users } from "../db/schema";
import type { ProviderRates, RateProvider } from "../fx/providers/types";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

function fakeProvider(rates: Record<string, string>, asOf: string, delayMs = 0): RateProvider {
  return {
    source: "open-er-api",
    fetchRates: vi.fn(async (baseCurrency: string): Promise<ProviderRates> => {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      return { baseCurrency, asOf, source: "open-er-api", rates };
    }),
  };
}

describe.skipIf(!hasTestDatabase)("fx service", () => {
  setupTestDb();

  let refreshRates: typeof import("./fx").refreshRates;
  let ensureRate: typeof import("./fx").ensureRate;
  let RateUnavailableError: typeof import("./fx").RateUnavailableError;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "false");

    ({ refreshRates, ensureRate, RateUnavailableError } = await import("./fx"));
  });

  afterAll(() => vi.unstubAllEnvs());
  afterEach(() => vi.restoreAllMocks());

  function today(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  }

  it("refreshRates fetches from the configured provider and upserts", async () => {
    vi.spyOn(await import("../fx/providers"), "getRateProvider").mockReturnValue(
      fakeProvider({ USD: "1", COP: "3062.957648", EUR: "0.856908" }, today()),
    );

    const result = await refreshRates();
    expect(result).toEqual({ inserted: 2, asOf: today(), source: "open-er-api" });
  });

  it("ensureRate returns a stored rate for today without calling the provider", async () => {
    const db = getTestDb();
    await db.insert(fxRates).values({
      baseCurrency: "USD",
      quoteCurrency: "COP",
      rate: "3062.957648",
      asOf: today(),
      source: "open-er-api",
    });
    const provider = fakeProvider({}, today());
    vi.spyOn(await import("../fx/providers"), "getRateProvider").mockReturnValue(provider);

    const result = await ensureRate("COP");
    expect(result.rate).toBe("3062.9576480000");
    expect(provider.fetchRates).not.toHaveBeenCalled();
  });

  it("ensureRate fetches on demand when today's rate is missing", async () => {
    const provider = fakeProvider({ USD: "1", COP: "3062.957648", EUR: "0.856908" }, today());
    vi.spyOn(await import("../fx/providers"), "getRateProvider").mockReturnValue(provider);

    const result = await ensureRate("COP");
    expect(result.rate).toBe("3062.9576480000");
    expect(provider.fetchRates).toHaveBeenCalledTimes(1);
  });

  it("concurrent lazy fetches for the same (or a different) pair share one in-flight refresh", async () => {
    const provider = fakeProvider({ USD: "1", COP: "3062.957648", EUR: "0.856908" }, today(), 20);
    vi.spyOn(await import("../fx/providers"), "getRateProvider").mockReturnValue(provider);

    const [cop1, cop2, eur] = await Promise.all([ensureRate("COP"), ensureRate("COP"), ensureRate("EUR")]);

    expect(provider.fetchRates).toHaveBeenCalledTimes(1);
    expect(cop1.rate).toBe(cop2.rate);
    expect(eur.rate).toBe("0.8569080000");
  });

  it("throws RateUnavailableError naming the pair and date when the provider is down, never a stale fallback", async () => {
    const provider: RateProvider = {
      source: "open-er-api",
      fetchRates: vi.fn().mockRejectedValue(new Error("provider is down")),
    };
    vi.spyOn(await import("../fx/providers"), "getRateProvider").mockReturnValue(provider);

    const error = await ensureRate("COP").catch((e) => e);
    expect(error).toBeInstanceOf(RateUnavailableError);
    expect(error.details).toEqual({ from: "USD", to: "COP", date: today() });
  });

  it("a subsequent ensureRate call after a failed refresh retries rather than staying stuck", async () => {
    // getRateProvider() is called more than once per ensureRate — once for
    // .source, again inside the refresh itself — so the mock must cover
    // every call in this phase, not just the first.
    const failing: RateProvider = { source: "open-er-api", fetchRates: vi.fn().mockRejectedValue(new Error("down")) };
    const spy = vi.spyOn(await import("../fx/providers"), "getRateProvider").mockReturnValue(failing);
    await expect(ensureRate("COP")).rejects.toThrow(RateUnavailableError);

    const recovered = fakeProvider({ USD: "1", COP: "3062.957648", EUR: "0.856908" }, today());
    spy.mockReturnValue(recovered);
    const result = await ensureRate("COP");
    expect(result.rate).toBe("3062.9576480000");
  });

  it("throws RateUnavailableError if the refresh succeeds but still doesn't produce today's rate", async () => {
    // A provider reporting yesterday's date for some reason — the refresh
    // itself doesn't throw, but the row it writes still isn't "today".
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleAsOf = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`;
    const provider = fakeProvider({ USD: "1", COP: "3062.957648", EUR: "0.856908" }, staleAsOf);
    vi.spyOn(await import("../fx/providers"), "getRateProvider").mockReturnValue(provider);

    await expect(ensureRate("COP")).rejects.toThrow(RateUnavailableError);
  });
});

describe.skipIf(!hasTestDatabase)("loadConversionContext / convertAmounts / convertSettlementAmount", () => {
  setupTestDb();

  let loadConversionContext: typeof import("./fx").loadConversionContext;
  let convertAmounts: typeof import("./fx").convertAmounts;
  let convertSettlementAmount: typeof import("./fx").convertSettlementAmount;
  let RateUnavailableError: typeof import("./fx").RateUnavailableError;
  let createGroup: typeof import("./groups").createGroup;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "false");

    ({ loadConversionContext, convertAmounts, convertSettlementAmount, RateUnavailableError } = await import("./fx"));
    ({ createGroup } = await import("./groups"));
  });

  afterAll(() => vi.unstubAllEnvs());

  async function seedGroupWithPin(rate: string) {
    const db = getTestDb();
    const [owner] = await db
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Ana", passwordHash: "x" })
      .returning();
    const group = await createGroup(owner!.id, { title: "Trip" });
    await db.insert(groupFxPins).values({
      groupId: group.id,
      fromCurrency: "COP",
      toCurrency: "USD",
      rate,
      asOf: "2026-08-24",
      source: "open-er-api",
      pinnedBy: owner!.id,
    });
    return group.id;
  }

  it("loads the pins for the display currency and every currency's exponent", async () => {
    const groupId = await seedGroupWithPin("0.00025");
    const ctx = await loadConversionContext(groupId, "USD");

    expect(ctx.ratesByFromCurrency.get("COP")).toBe(2500000n);
    expect(ctx.exponentsByCurrency.get("COP")).toBe(2);
    expect(ctx.exponentsByCurrency.get("USD")).toBe(2);
    expect(ctx.pins).toEqual([
      expect.objectContaining({ fromCurrency: "COP", toCurrency: "USD", rate: "0.0002500000" }),
    ]);
  });

  it("convertAmounts passes an already-display-currency expense through unchanged", async () => {
    const groupId = await seedGroupWithPin("0.00025");
    const ctx = await loadConversionContext(groupId, "USD");
    const amounts = { total: 100n, payers: new Map([["ana", 100n]]), splits: new Map([["ana", 100n]]) };

    const result = convertAmounts(ctx, "USD", "expense-1", amounts);
    expect(result).toEqual({ currency: "USD", ...amounts });
  });

  it("convertAmounts converts a foreign-currency expense using its pin", async () => {
    const groupId = await seedGroupWithPin("0.00025");
    const ctx = await loadConversionContext(groupId, "USD");

    const result = convertAmounts(ctx, "COP", "expense-1", {
      total: 30000n,
      payers: new Map([["ana", 30000n]]),
      splits: new Map([
        ["ana", 15000n],
        ["beto", 15000n],
      ]),
    });
    expect(result.currency).toBe("USD");
    expect(result.total).toBe(8n);
  });

  it("convertAmounts throws RATE_UNAVAILABLE for a currency with no pin, e.g. one added after the group last pinned", async () => {
    const groupId = await seedGroupWithPin("0.00025");
    const ctx = await loadConversionContext(groupId, "USD");

    expect(() =>
      convertAmounts(ctx, "EUR", "expense-1", { total: 100n, payers: new Map([["ana", 100n]]), splits: new Map([["ana", 100n]]) }),
    ).toThrow(RateUnavailableError);
  });

  it("convertSettlementAmount converts a single amount, no apportionment involved", async () => {
    const groupId = await seedGroupWithPin("0.00025");
    const ctx = await loadConversionContext(groupId, "USD");

    expect(convertSettlementAmount(ctx, "COP", 30000n)).toEqual({ currency: "USD", amount: 8n });
    expect(convertSettlementAmount(ctx, "USD", 30000n)).toEqual({ currency: "USD", amount: 30000n });
  });
});
