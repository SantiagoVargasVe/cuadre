import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";
const EMAIL = "ana@example.com";

describe.skipIf(!hasTestDatabase)("GET /api/auth/me", () => {
  setupTestDb();

  let meGET: typeof import("./route").GET;
  let token: string;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ GET: meGET } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  // setupTestDb() truncates every table after each test, so both the user
  // row and its token (bound to the row's freshly-generated id) have to be
  // recreated before each test, not once in beforeAll.
  beforeEach(async () => {
    const [{ users }, { signSessionToken }] = await Promise.all([
      import("../../../../server/db/schema"),
      import("../../../../server/auth/jwt"),
    ]);
    const [user] = await getTestDb()
      .insert(users)
      .values({ email: EMAIL, displayName: "Ana", passwordHash: "irrelevant" })
      .returning();
    token = await signSessionToken(user!.id);
  });

  it("rejects a request with no session", async () => {
    const response = await meGET(new NextRequest(`${APP_URL}/api/auth/me`));
    expect(response.status).toBe(401);
  });

  it("rejects an expired or garbage token the same way", async () => {
    const response = await meGET(
      new NextRequest(`${APP_URL}/api/auth/me`, {
        headers: { authorization: "Bearer not-a-real-token" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("returns the user and an empty groups[] for a valid Bearer token", async () => {
    const response = await meGET(
      new NextRequest(`${APP_URL}/api/auth/me`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.email).toBe(EMAIL);
    expect(body.groups).toEqual([]);
  });

  it("also accepts the session cookie", async () => {
    const response = await meGET(
      new NextRequest(`${APP_URL}/api/auth/me`, {
        headers: { cookie: `cuadre_session=${token}` },
      }),
    );

    expect(response.status).toBe(200);
  });
});
