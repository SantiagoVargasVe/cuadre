import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

/**
 * The test that matters most (T011 acceptance criteria): two concurrent
 * registrations against the *same* single-use invite code. Exactly one
 * must succeed and the other must get 409 — never both succeeding, never
 * both failing. Different emails so the email-uniqueness constraint can't
 * be what decides the outcome; this has to be the invite's own
 * conditional UPDATE doing the serializing. Split into its own file so
 * the main route.test.ts stays under the 100-line component limit.
 */
describe.skipIf(!hasTestDatabase)("POST /api/auth/register — concurrent race", () => {
  setupTestDb();

  let registerPOST: typeof import("./route").POST;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ POST: registerPOST } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const { inviteCodes } = await import("../../../../server/db/schema");
    await getTestDb().insert(inviteCodes).values({ code: "racing-invite" });
  });

  function request(email: string) {
    return new NextRequest(`${APP_URL}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP_URL },
      body: JSON.stringify({
        email,
        displayName: "Racer",
        password: "correct horse battery staple",
        inviteCode: "racing-invite",
      }),
    });
  }

  it("lets exactly one of two racing registrations win", async () => {
    const [a, b] = await Promise.all([
      registerPOST(request("racer-a@example.com")),
      registerPOST(request("racer-b@example.com")),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);

    const loser = a.status === 201 ? b : a;
    expect((await loser.json()).error.code).toBe("INVALID_INVITE_CODE");
  });
});
