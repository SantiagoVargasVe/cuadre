import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

/**
 * The T123 ↔ T125 seam, end to end: a successful reset must stop every
 * session that existed before it. Asserted here through a real
 * authenticated route (`GET /api/auth/me`), not only in T123's unit
 * tests, because this is the pair whose seam is most likely to be wrong.
 */
describe.skipIf(!hasTestDatabase)("reset-password revokes prior sessions", () => {
  setupTestDb();

  let resetPOST: typeof import("./route").POST;
  let meGET: typeof import("../me/route").GET;
  let mintToken: typeof import("../../../../server/auth/tokens").mintToken;
  let signSessionToken: typeof import("../../../../server/auth/jwt").signSessionToken;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");
    ({ POST: resetPOST } = await import("./route"));
    ({ GET: meGET } = await import("../me/route"));
    ({ mintToken } = await import("../../../../server/auth/tokens"));
    ({ signSessionToken } = await import("../../../../server/auth/jwt"));
  });

  afterAll(() => vi.unstubAllEnvs());

  function me(token: string) {
    return meGET(
      new NextRequest(`${APP_URL}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } }),
    );
  }

  it("invalidates a session captured before the reset", async () => {
    const { users } = await import("../../../../server/db/schema");
    const [user] = await getTestDb()
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Ana", passwordHash: "x" })
      .returning();
    const oldToken = await signSessionToken(user!.id);
    const resetToken = await mintToken(getTestDb(), user!.id, "password_reset");

    expect((await me(oldToken)).status).toBe(200);

    const reset = await resetPOST(
      new NextRequest(`${APP_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: APP_URL, "cf-connecting-ip": "203.0.113.7" },
        body: JSON.stringify({ token: resetToken, password: "a brand new passphrase" }),
      }),
    );
    expect(reset.status).toBe(204);

    expect((await me(oldToken)).status).toBe(401);
  });
});
