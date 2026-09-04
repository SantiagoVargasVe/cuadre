import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("POST /api/auth/verify-email", () => {
  setupTestDb();

  let verifyPOST: typeof import("./route").POST;
  let mintToken: typeof import("../../../../server/auth/tokens").mintToken;
  let hashToken: typeof import("../../../../server/auth/tokens").hashToken;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");
    ({ POST: verifyPOST } = await import("./route"));
    ({ mintToken, hashToken } = await import("../../../../server/auth/tokens"));
  });

  afterAll(() => vi.unstubAllEnvs());

  async function seedUser() {
    const { users } = await import("../../../../server/db/schema");
    const [user] = await getTestDb()
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Ana", passwordHash: "x" })
      .returning();
    return user!;
  }

  function req(body: unknown) {
    return new NextRequest(`${APP_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function verifiedAt(userId: string) {
    const { users } = await import("../../../../server/db/schema");
    return (await getTestDb().select().from(users).where(eq(users.id, userId)))[0]?.emailVerifiedAt;
  }

  it("marks the address verified and returns 204", async () => {
    const user = await seedUser();
    const token = await mintToken(getTestDb(), user.id, "email_verify");

    const response = await verifyPOST(req({ token }));

    expect(response.status).toBe(204);
    expect(await verifiedAt(user.id)).toBeInstanceOf(Date);
  });

  it("returns a generic 400 for a reused token", async () => {
    const user = await seedUser();
    const token = await mintToken(getTestDb(), user.id, "email_verify");
    await verifyPOST(req({ token }));

    const response = await verifyPOST(req({ token }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_TOKEN");
  });

  it("returns the same generic 400 for an expired token", async () => {
    const { authTokens } = await import("../../../../server/db/schema");
    const user = await seedUser();
    await getTestDb().insert(authTokens).values({
      tokenHash: hashToken("expired-verify"),
      userId: user.id,
      purpose: "email_verify",
      expiresAt: new Date(Date.now() - 1000),
    });

    const response = await verifyPOST(req({ token: "expired-verify" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_TOKEN");
  });

  it("rejects a password_reset token presented to the verify endpoint", async () => {
    const user = await seedUser();
    const resetToken = await mintToken(getTestDb(), user.id, "password_reset");

    const response = await verifyPOST(req({ token: resetToken }));
    expect(response.status).toBe(400);
    expect(await verifiedAt(user.id)).toBeNull();
  });

  it("returns 400 VALIDATION_ERROR for a body without a token", async () => {
    const response = await verifyPOST(req({}));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("rate limits by IP — the 11th attempt in a window is 429", async () => {
    let last = await verifyPOST(req({ token: "nope" }));
    for (let i = 0; i < 10; i++) last = await verifyPOST(req({ token: "nope" }));
    expect(last.status).toBe(429);
    expect(last.headers.get("Retry-After")).toBeTruthy();
  });
});
