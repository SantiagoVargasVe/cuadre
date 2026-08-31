import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../../../../test/db";
import type { ProviderRates, RateProvider } from "../../../../../server/fx/providers/types";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";
const today = (): string => new Date().toISOString().slice(0, 10);

const fakeProvider = (): RateProvider => ({
  source: "open-er-api",
  fetchRates: vi.fn(
    (baseCurrency: string): Promise<ProviderRates> =>
      Promise.resolve({ baseCurrency, asOf: today(), source: "open-er-api", rates: { USD: "1", COP: "4000", EUR: "0.8" } }),
  ),
});

describe.skipIf(!hasTestDatabase)("/api/groups/[id]/fx-quote (T104)", () => {
  setupTestDb();

  let GET: typeof import("./route").GET;
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
    ({ GET } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());
  afterEach(() => vi.restoreAllMocks());

  beforeEach(async () => {
    const [{ users }, { signSessionToken }, { createGroup }, providers] = await Promise.all([
      import("../../../../../server/db/schema"),
      import("../../../../../server/auth/jwt"),
      import("../../../../../server/services/groups"),
      import("../../../../../server/fx/providers"),
    ]);
    const db = getTestDb();
    const mk = (email: string) => db.insert(users).values({ email, displayName: email, passwordHash: "x" }).returning();
    const [[owner], [outsider]] = await Promise.all([mk("ana@example.com"), mk("out@example.com")]);
    ownerToken = await signSessionToken(owner!.id);
    outsiderToken = await signSessionToken(outsider!.id);
    groupId = (await createGroup(owner!.id, { title: "Trip" })).id;
    vi.spyOn(providers, "getRateProvider").mockReturnValue(fakeProvider());
  });

  const ctx = () => ({ params: Promise.resolve({ id: groupId }) });
  const req = (qs: string, token = ownerToken) =>
    new NextRequest(`${APP_URL}/api/groups/${groupId}/fx-quote${qs}`, {
      headers: { origin: APP_URL, authorization: `Bearer ${token}` },
    });

  it("returns { rate, asOf, source } for a member", async () => {
    const res = await GET(req("?from=USD&to=COP"), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ rate: "4000.0000000000", asOf: today(), source: "open-er-api" });
  });

  it("404s for a non-member", async () => {
    expect((await GET(req("?from=USD&to=COP", outsiderToken), ctx())).status).toBe(404);
  });

  it("400s on a malformed pair", async () => {
    expect((await GET(req("?from=US&to=COP"), ctx())).status).toBe(400);
  });

  it("422s CURRENCY_NOT_SUPPORTED for a code outside SUPPORTED_CURRENCIES", async () => {
    const res = await GET(req("?from=JPY&to=COP"), ctx());
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("CURRENCY_NOT_SUPPORTED");
  });
});
