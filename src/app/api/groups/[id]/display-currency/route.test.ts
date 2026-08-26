import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../../test/db";
import type { ProviderRates, RateProvider } from "../../../../../server/fx/providers/types";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

const today = (): string => new Date().toISOString().slice(0, 10);

const fakeProvider = (): RateProvider => ({
  source: "open-er-api",
  fetchRates: vi.fn(
    (baseCurrency: string): Promise<ProviderRates> =>
      Promise.resolve({
        baseCurrency,
        asOf: today(),
        source: "open-er-api",
        rates: { USD: "1", COP: "3062.957648", EUR: "0.856908" },
      }),
  ),
});

describe.skipIf(!hasTestDatabase)("/api/groups/[id]/display-currency", () => {
  setupTestDb();

  let displayCurrencyGET: typeof import("./route").GET;
  let displayCurrencyPUT: typeof import("./route").PUT;
  let displayCurrencyDELETE: typeof import("./route").DELETE;
  let ownerToken: string;
  let outsiderToken: string;
  let groupId: string;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "false");

    ({ GET: displayCurrencyGET, PUT: displayCurrencyPUT, DELETE: displayCurrencyDELETE } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());
  afterEach(() => vi.restoreAllMocks());

  beforeEach(async () => {
    const [{ users }, { signSessionToken }, { createGroup }, { createExpense }, providers] = await Promise.all([
      import("../../../../../server/db/schema"),
      import("../../../../../server/auth/jwt"),
      import("../../../../../server/services/groups"),
      import("../../../../../server/services/expenses"),
      import("../../../../../server/fx/providers"),
    ]);
    const db = getTestDb();
    const user = (email: string) => db.insert(users).values({ email, displayName: email, passwordHash: "x" }).returning();
    const [[owner], [outsider]] = await Promise.all([user("ana@example.com"), user("outsider@example.com")]);
    ownerToken = await signSessionToken(owner!.id);
    outsiderToken = await signSessionToken(outsider!.id);
    groupId = (await createGroup(owner!.id, { title: "Cartagena 2026" })).id;
    await createExpense(groupId, owner!.id, {
      title: "Dinner",
      date: "2026-08-24",
      amount: "10000",
      currency: "COP",
      split: { strategy: "equal" },
    });
    vi.spyOn(providers, "getRateProvider").mockReturnValue(fakeProvider());
  });

  const ctx = () => ({ params: Promise.resolve({ id: groupId }) });

  function req(method: string, token: string, body?: unknown) {
    return new NextRequest(`${APP_URL}/api/groups/${groupId}/display-currency`, {
      method,
      headers: { origin: APP_URL, authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  it("PUT sets displayCurrency and returns the pins", async () => {
    const body = await (await displayCurrencyPUT(req("PUT", ownerToken, { currency: "USD" }), ctx())).json();
    expect(body.group.displayCurrency).toBe("USD");
    expect(body.pins).toEqual([expect.objectContaining({ fromCurrency: "COP", toCurrency: "USD" })]);
  });

  it("PUT 404s for a non-member", async () => {
    expect((await displayCurrencyPUT(req("PUT", outsiderToken, { currency: "USD" }), ctx())).status).toBe(404);
  });

  it("GET returns the current currency and pins", async () => {
    await displayCurrencyPUT(req("PUT", ownerToken, { currency: "USD" }), ctx());
    const body = await (await displayCurrencyGET(req("GET", ownerToken), ctx())).json();
    expect(body).toEqual({ currency: "USD", pins: [expect.objectContaining({ fromCurrency: "COP" })] });
  });

  it("DELETE clears displayCurrency but keeps the pins", async () => {
    await displayCurrencyPUT(req("PUT", ownerToken, { currency: "USD" }), ctx());

    const deleted = await (await displayCurrencyDELETE(req("DELETE", ownerToken), ctx())).json();
    expect(deleted.group.displayCurrency).toBeNull();

    const after = await (await displayCurrencyGET(req("GET", ownerToken), ctx())).json();
    expect(after.pins).toHaveLength(1);
  });

  it("PUT 403s with no Origin and no Bearer", async () => {
    const noOrigin = new NextRequest(`${APP_URL}/api/groups/${groupId}/display-currency`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currency: "USD" }),
    });
    expect((await displayCurrencyPUT(noOrigin, ctx())).status).toBe(403);
  });
});
