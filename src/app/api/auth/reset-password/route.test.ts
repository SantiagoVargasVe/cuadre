import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";
const NEW_PASSWORD = "a brand new passphrase";

describe.skipIf(!hasTestDatabase)("POST /api/auth/reset-password", () => {
  setupTestDb();

  let resetPOST: typeof import("./route").POST;
  let mintToken: typeof import("../../../../server/auth/tokens").mintToken;
  let verifyPassword: typeof import("../../../../server/auth/password").verifyPassword;
  let hashPassword: typeof import("../../../../server/auth/password").hashPassword;

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
    ({ mintToken } = await import("../../../../server/auth/tokens"));
    ({ verifyPassword, hashPassword } = await import("../../../../server/auth/password"));
  });

  afterAll(() => vi.unstubAllEnvs());

  async function seedUser() {
    const { users } = await import("../../../../server/db/schema");
    const [user] = await getTestDb()
      .insert(users)
      .values({
        email: `${crypto.randomUUID()}@example.com`,
        displayName: "Ana",
        passwordHash: await hashPassword("old passphrase"),
      })
      .returning();
    return user!;
  }

  function req(body: unknown, ip = "203.0.113.50") {
    return new NextRequest(`${APP_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP_URL, "cf-connecting-ip": ip },
      body: JSON.stringify(body),
    });
  }

  it("writes a new hash, moves sessions_valid_from, sets no cookie, returns 204", async () => {
    const { users } = await import("../../../../server/db/schema");
    const user = await seedUser();
    const token = await mintToken(getTestDb(), user.id, "password_reset");

    const response = await resetPOST(req({ token, password: NEW_PASSWORD }));

    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie?.() ?? []).toHaveLength(0);
    const [after] = await getTestDb().select().from(users).where(eq(users.id, user.id));
    expect(await verifyPassword(NEW_PASSWORD, after!.passwordHash)).toBe(true);
    expect(after!.sessionsValidFrom.getTime()).toBeGreaterThan(user.sessionsValidFrom.getTime());
  });

  it("returns the same generic 400 for a used token", async () => {
    const user = await seedUser();
    const token = await mintToken(getTestDb(), user.id, "password_reset");
    await resetPOST(req({ token, password: NEW_PASSWORD }));

    const response = await resetPOST(req({ token, password: "another one entirely" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_TOKEN");
  });

  it("400s a password that fails registration's rule", async () => {
    const user = await seedUser();
    const token = await mintToken(getTestDb(), user.id, "password_reset");

    const response = await resetPOST(req({ token, password: "short" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("rate limits per IP", async () => {
    let last = await resetPOST(req({ token: "nope", password: NEW_PASSWORD }, "198.51.100.90"));
    for (let i = 0; i < 10; i++) {
      last = await resetPOST(req({ token: "nope", password: NEW_PASSWORD }, "198.51.100.90"));
    }
    expect(last.status).toBe(429);
  });
});
