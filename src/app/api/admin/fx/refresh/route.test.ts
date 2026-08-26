import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb } from "../../../../../test/db";
import type { ProviderRates, RateProvider } from "../../../../../server/fx/providers/types";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";
const TOKEN = "a".repeat(32);

function fakeProvider(): RateProvider {
  return {
    source: "open-er-api",
    fetchRates: vi.fn(
      (baseCurrency: string): Promise<ProviderRates> =>
        Promise.resolve({
          baseCurrency,
          asOf: "2026-08-26",
          source: "open-er-api",
          rates: { USD: "1", COP: "3062.957648", EUR: "0.856908" },
        }),
    ),
  };
}

function stubEnv(refreshToken?: string) {
  vi.stubEnv("APP_URL", APP_URL);
  vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
  vi.stubEnv("AUTH_SECRET", "a".repeat(48));
  vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
  vi.stubEnv("DEFAULT_CURRENCY", "COP");
  vi.stubEnv("FX_PROVIDER", "open-er-api");
  vi.stubEnv("FX_BASE_CURRENCY", "USD");
  vi.stubEnv("FX_TRM_CROSSCHECK", "false");
  if (refreshToken !== undefined) vi.stubEnv("FX_REFRESH_TOKEN", refreshToken);
}

function req(authorization?: string) {
  return new NextRequest(`${APP_URL}/api/admin/fx/refresh`, {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

describe.skipIf(!hasTestDatabase)("POST /api/admin/fx/refresh — token unset", () => {
  setupTestDb();
  let refreshPOST: typeof import("./route").POST;

  beforeAll(async () => {
    vi.resetModules();
    stubEnv(undefined);
    ({ POST: refreshPOST } = await import("./route"));
  });
  afterAll(() => vi.unstubAllEnvs());

  it("returns 404, not 401, so a misconfigured deploy fails closed", async () => {
    const response = await refreshPOST(req(`Bearer ${TOKEN}`));
    expect(response.status).toBe(404);
  });
});

describe.skipIf(!hasTestDatabase)("POST /api/admin/fx/refresh — token set", () => {
  setupTestDb();
  let refreshPOST: typeof import("./route").POST;

  beforeAll(async () => {
    vi.resetModules();
    stubEnv(TOKEN);
    ({ POST: refreshPOST } = await import("./route"));
  });
  afterAll(() => vi.unstubAllEnvs());
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 for a missing Authorization header", async () => {
    expect((await refreshPOST(req())).status).toBe(401);
  });

  it("returns 401 for the wrong token", async () => {
    expect((await refreshPOST(req("Bearer wrong-token-wrong-token-wrong"))).status).toBe(401);
  });

  it("returns 200 with { inserted, asOf, source } for the correct token", async () => {
    vi.spyOn(await import("../../../../../server/fx/providers"), "getRateProvider").mockReturnValue(
      fakeProvider(),
    );

    const response = await refreshPOST(req(`Bearer ${TOKEN}`));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ inserted: 2, asOf: "2026-08-26", source: "open-er-api" });
  });

  it("is idempotent: a second call the same day inserts nothing new", async () => {
    vi.spyOn(await import("../../../../../server/fx/providers"), "getRateProvider").mockReturnValue(
      fakeProvider(),
    );

    await refreshPOST(req(`Bearer ${TOKEN}`));
    const second = await refreshPOST(req(`Bearer ${TOKEN}`));
    expect((await second.json()).inserted).toBe(0);
  });

  it("rate limits past the policy's capacity", async () => {
    vi.spyOn(await import("../../../../../server/fx/providers"), "getRateProvider").mockReturnValue(
      fakeProvider(),
    );

    let last;
    for (let i = 0; i < 6; i++) last = await refreshPOST(req(`Bearer ${TOKEN}`));
    expect(last!.status).toBe(429);
  });
});
