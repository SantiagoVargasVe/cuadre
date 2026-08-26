import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { fxRates } from "../db/schema";
import type { ProviderRates, RateProvider } from "./providers/types";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

function fakeProvider(rates: Record<string, string>, asOf = "2026-08-26", source = "fake"): RateProvider {
  return {
    source,
    fetchRates: vi.fn(
      (baseCurrency: string): Promise<ProviderRates> =>
        Promise.resolve({ baseCurrency, asOf, source, rates }),
    ),
  };
}

describe.skipIf(!hasTestDatabase)("refreshCore", () => {
  setupTestDb();

  let refreshCore: typeof import("./refresh-core").refreshCore;
  let findLatestRate: typeof import("./refresh-core").findLatestRate;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ refreshCore, findLatestRate } = await import("./refresh-core"));
  });

  afterAll(() => vi.unstubAllEnvs());
  afterEach(() => vi.restoreAllMocks());

  it("inserts one row per non-base currency, skipping the base's own self-pair", async () => {
    const db = getTestDb();
    const provider = fakeProvider({ USD: "1", COP: "3062.957648", EUR: "0.856908" });

    const result = await refreshCore(db, provider, "USD", ["USD", "COP", "EUR"], false);

    expect(result).toEqual({ inserted: 2, asOf: "2026-08-26", source: "fake" });
    const rows = await db.select().from(fxRates);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.quoteCurrency).sort()).toEqual(["COP", "EUR"]);
  });

  it("is idempotent: ten runs insert once, never overwriting the stored rate", async () => {
    const db = getTestDb();
    const provider = fakeProvider({ USD: "1", COP: "3062.957648" });

    for (let i = 0; i < 10; i++) {
      await refreshCore(db, provider, "USD", ["USD", "COP"], false);
    }

    const rows = await db
      .select()
      .from(fxRates)
      .where(and(eq(fxRates.baseCurrency, "USD"), eq(fxRates.quoteCurrency, "COP")));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rate).toBe("3062.9576480000");
  });

  it("a later run on a new day inserts a second, independent row rather than overwriting the first", async () => {
    const db = getTestDb();
    await refreshCore(db, fakeProvider({ USD: "1", COP: "3000" }, "2026-08-25"), "USD", ["USD", "COP"], false);
    await refreshCore(db, fakeProvider({ USD: "1", COP: "3100" }, "2026-08-26"), "USD", ["USD", "COP"], false);

    const rows = await db.select().from(fxRates).where(eq(fxRates.quoteCurrency, "COP"));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.rate).sort()).toEqual(["3000.0000000000", "3100.0000000000"]);
  });

  it("finds the latest of several stored rates for a pair", async () => {
    const db = getTestDb();
    await refreshCore(db, fakeProvider({ USD: "1", COP: "3000" }, "2026-08-20"), "USD", ["USD", "COP"], false);
    await refreshCore(db, fakeProvider({ USD: "1", COP: "3100" }, "2026-08-26"), "USD", ["USD", "COP"], false);

    const latest = await findLatestRate(db, "USD", "COP", "fake");
    expect(latest).toEqual({ rate: "3100.0000000000", asOf: "2026-08-26" });
  });

  it("returns undefined from findLatestRate when no rate has ever been stored", async () => {
    const db = getTestDb();
    expect(await findLatestRate(db, "USD", "COP", "fake")).toBeUndefined();
  });

  it("runs the TRM cross-check when enabled, base is USD, and COP is present — without failing the refresh if TRM itself fails", async () => {
    const db = getTestDb();
    const trmModule = await import("./providers/trm");
    vi.spyOn(trmModule, "fetchTrmRate").mockRejectedValue(new Error("TRM down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const provider = fakeProvider({ USD: "1", COP: "3062.957648" });
    const result = await refreshCore(db, provider, "USD", ["USD", "COP"], true);

    expect(result.inserted).toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("TRM fetch failed"), expect.any(Error));
  });

  it("logs the TRM comparison when the cross-check itself succeeds", async () => {
    const db = getTestDb();
    const trmModule = await import("./providers/trm");
    vi.spyOn(trmModule, "fetchTrmRate").mockResolvedValue({
      rate: "3200.00",
      asOf: "2026-08-26",
      vigenciaDesde: "2026-08-26",
      vigenciaHasta: "2026-08-26",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await refreshCore(db, fakeProvider({ USD: "1", COP: "3062.957648" }), "USD", ["USD", "COP"], true);

    // 3062.96 vs 3200.00 is a genuine divergence past the 1% threshold.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("disagree"));
  });

  it("skips the TRM cross-check entirely when disabled", async () => {
    const db = getTestDb();
    const trmModule = await import("./providers/trm");
    const fetchSpy = vi.spyOn(trmModule, "fetchTrmRate");

    await refreshCore(db, fakeProvider({ USD: "1", COP: "3062.957648" }), "USD", ["USD", "COP"], false);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
