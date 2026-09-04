import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";
const CURRENT = "the current passphrase";
const NEXT = "a fresh new passphrase";

describe.skipIf(!hasTestDatabase)("POST /api/auth/change-password", () => {
  setupTestDb();

  let changePOST: typeof import("./route").POST;
  let signSessionToken: typeof import("../../../../server/auth/jwt").signSessionToken;
  let hashPassword: typeof import("../../../../server/auth/password").hashPassword;
  let verifyPassword: typeof import("../../../../server/auth/password").verifyPassword;
  let userId: string;
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
    ({ POST: changePOST } = await import("./route"));
    ({ signSessionToken } = await import("../../../../server/auth/jwt"));
    ({ hashPassword, verifyPassword } = await import("../../../../server/auth/password"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const { users } = await import("../../../../server/db/schema");
    const [user] = await getTestDb()
      .insert(users)
      .values({
        email: `${crypto.randomUUID()}@example.com`,
        displayName: "Ana",
        passwordHash: await hashPassword(CURRENT),
      })
      .returning();
    userId = user!.id;
    token = await signSessionToken(userId);
  });

  function req(body: unknown, sessionToken = token, ip = "203.0.113.60") {
    return new NextRequest(`${APP_URL}/api/auth/change-password`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: APP_URL,
        authorization: `Bearer ${sessionToken}`,
        "cf-connecting-ip": ip,
      },
      body: JSON.stringify(body),
    });
  }

  it("changes the password and moves the session epoch, returning 204 + a fresh cookie", async () => {
    const { users } = await import("../../../../server/db/schema");
    const before = (await getTestDb().select().from(users).where(eq(users.id, userId)))[0]!;

    const response = await changePOST(req({ currentPassword: CURRENT, newPassword: NEXT }));

    expect(response.status).toBe(204);
    expect(response.cookies.get("cuadre_session")?.value).toBeTruthy();
    const after = (await getTestDb().select().from(users).where(eq(users.id, userId)))[0]!;
    expect(await verifyPassword(NEXT, after.passwordHash)).toBe(true);
    expect(after.sessionsValidFrom.getTime()).toBeGreaterThan(before.sessionsValidFrom.getTime());
  });

  it("rejects a wrong current password as 401 INVALID_CREDENTIALS", async () => {
    const response = await changePOST(req({ currentPassword: "not it", newPassword: NEXT }));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("INVALID_CREDENTIALS");
  });

  it("400s a new password that fails registration's rule", async () => {
    const response = await changePOST(req({ currentPassword: CURRENT, newPassword: "short" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("401s an unauthenticated request", async () => {
    const response = await changePOST(
      new NextRequest(`${APP_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: APP_URL },
        body: JSON.stringify({ currentPassword: CURRENT, newPassword: NEXT }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rate limits per user", async () => {
    let last = await changePOST(req({ currentPassword: "x", newPassword: NEXT }));
    for (let i = 0; i < 5; i++) {
      last = await changePOST(req({ currentPassword: "x", newPassword: NEXT }));
    }
    expect(last.status).toBe(429);
  });
});
