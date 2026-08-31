import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../test/db";
import { fxRates, groupFxPins, groups, users } from "../db/schema";
import type { ProviderRates, RateProvider } from "../fx/providers/types";
import { eq } from "drizzle-orm";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

function fakeProvider(rates: Record<string, string>, asOf: string): RateProvider {
  return {
    source: "open-er-api",
    fetchRates: vi.fn(
      async (baseCurrency: string): Promise<ProviderRates> => ({
        baseCurrency,
        asOf,
        source: "open-er-api",
        rates,
      }),
    ),
  };
}

describe.skipIf(!hasTestDatabase)("quoteRate (T104)", () => {
  setupTestDb();

  let quoteRate: typeof import("./fx").quoteRate;
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
    ({ quoteRate, RateUnavailableError } = await import("./fx"));
    ({ createGroup } = await import("./groups"));
  });

  afterAll(() => vi.unstubAllEnvs());

  function today(): string {
    const n = new Date();
    return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
  }

  async function seedMemberGroup() {
    const db = getTestDb();
    const [owner] = await db
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Ana", passwordHash: "x" })
      .returning();
    const group = await createGroup(owner!.id, { title: "Trip" });
    return { userId: owner!.id, groupId: group.id };
  }

  async function seedTodayRates(rates: Record<string, string>) {
    const db = getTestDb();
    for (const [quote, rate] of Object.entries(rates)) {
      await db.insert(fxRates).values({
        baseCurrency: "USD",
        quoteCurrency: quote,
        rate,
        asOf: today(),
        source: "open-er-api",
        fetchedAt: new Date(),
      });
    }
  }

  it("quotes to-per-from as the cross of the two USD legs, with asOf + source", async () => {
    const { userId, groupId } = await seedMemberGroup();
    // USD→COP 4000, USD→EUR 0.8  →  EUR→COP = 4000 / 0.8 = 5000
    await seedTodayRates({ COP: "4000", EUR: "0.8" });

    const quote = await quoteRate(groupId, userId, "EUR", "COP");
    expect(quote).toEqual({ rate: "5000.0000000000", asOf: today(), source: "open-er-api" });
  });

  it("quotes from the base currency directly (USD→COP)", async () => {
    const { userId, groupId } = await seedMemberGroup();
    await seedTodayRates({ COP: "4000" });

    const quote = await quoteRate(groupId, userId, "USD", "COP");
    expect(quote.rate).toBe("4000.0000000000");
  });

  it("returns rate 1 for a same-currency quote without touching the provider", async () => {
    const { userId, groupId } = await seedMemberGroup();
    const quote = await quoteRate(groupId, userId, "COP", "COP");
    expect(quote.rate).toBe("1.0000000000");
  });

  it("never writes a pin", async () => {
    const { userId, groupId } = await seedMemberGroup();
    await seedTodayRates({ COP: "4000", EUR: "0.8" });

    await quoteRate(groupId, userId, "EUR", "COP");

    const db = getTestDb();
    const pins = await db.select().from(groupFxPins).where(eq(groupFxPins.groupId, groupId));
    const [row] = await db.select({ dc: groups.displayCurrency }).from(groups).where(eq(groups.id, groupId));
    expect(pins).toHaveLength(0);
    expect(row!.dc).toBeNull();
  });

  it("RATE_UNAVAILABLE names the requested pair when the rate can't be had (never a stale fallback)", async () => {
    const { userId, groupId } = await seedMemberGroup();
    const down: RateProvider = { source: "open-er-api", fetchRates: vi.fn().mockRejectedValue(new Error("down")) };
    vi.spyOn(await import("../fx/providers"), "getRateProvider").mockReturnValue(down);

    const error = await quoteRate(groupId, userId, "EUR", "COP").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateUnavailableError);
    expect((error as InstanceType<typeof RateUnavailableError>).details).toMatchObject({
      from: "EUR",
      to: "COP",
    });
    vi.restoreAllMocks();
  });

  it("lazily fetches when today's rate is missing, then quotes it", async () => {
    const { userId, groupId } = await seedMemberGroup();
    vi.spyOn(await import("../fx/providers"), "getRateProvider").mockReturnValue(
      fakeProvider({ USD: "1", COP: "4000", EUR: "0.85" }, today()),
    );

    const quote = await quoteRate(groupId, userId, "USD", "COP");
    expect(quote.rate).toBe("4000.0000000000");
    vi.restoreAllMocks();
  });

  it("rejects a non-member", async () => {
    const { groupId } = await seedMemberGroup();
    const db = getTestDb();
    const [outsider] = await db
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Zoe", passwordHash: "x" })
      .returning();

    await expect(quoteRate(groupId, outsider!.id, "USD", "COP")).rejects.toThrow();
  });

  it("rejects an unsupported currency", async () => {
    const { userId, groupId } = await seedMemberGroup();
    await expect(quoteRate(groupId, userId, "JPY", "COP")).rejects.toThrow();
  });
});
