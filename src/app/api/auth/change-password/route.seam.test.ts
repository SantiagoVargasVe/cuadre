import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";
const CURRENT = "the current passphrase";
const NEXT = "a fresh new passphrase";

/**
 * The session seam: changing a password revokes every session, so the
 * caller must come out the other side still logged in (its replacement
 * token minted at the new boundary) while every *other* token — session
 * or `password_reset` — stops working.
 */
describe.skipIf(!hasTestDatabase)("change-password session seam", () => {
  setupTestDb();

  let changePOST: typeof import("./route").POST;
  let meGET: typeof import("../me/route").GET;
  let resetPOST: typeof import("../reset-password/route").POST;
  let signSessionToken: typeof import("../../../../server/auth/jwt").signSessionToken;
  let hashPassword: typeof import("../../../../server/auth/password").hashPassword;
  let mintToken: typeof import("../../../../server/auth/tokens").mintToken;
  let userId: string;

  beforeAll(async () => {
    for (const [k, v] of Object.entries({
      APP_URL,
      DATABASE_URL: DATABASE_URL_TEST ?? "",
      AUTH_SECRET: "a".repeat(48),
      SUPPORTED_CURRENCIES: "COP,USD,EUR",
      DEFAULT_CURRENCY: "COP",
      FX_PROVIDER: "open-er-api",
      FX_BASE_CURRENCY: "USD",
      FX_TRM_CROSSCHECK: "true",
    })) {
      vi.stubEnv(k, v);
    }
    ({ POST: changePOST } = await import("./route"));
    ({ GET: meGET } = await import("../me/route"));
    ({ POST: resetPOST } = await import("../reset-password/route"));
    ({ signSessionToken } = await import("../../../../server/auth/jwt"));
    ({ hashPassword } = await import("../../../../server/auth/password"));
    ({ mintToken } = await import("../../../../server/auth/tokens"));
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
  });

  function me(token: string) {
    return meGET(
      new NextRequest(`${APP_URL}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } }),
    );
  }

  function changeReq(token: string) {
    return new NextRequest(`${APP_URL}/api/auth/change-password`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: APP_URL,
        authorization: `Bearer ${token}`,
        "cf-connecting-ip": "203.0.113.61",
      },
      body: JSON.stringify({ currentPassword: CURRENT, newPassword: NEXT }),
    });
  }

  it("keeps the caller in with the replacement, closes every other session and reset link", async () => {
    const callerToken = await signSessionToken(userId);
    const otherSession = await signSessionToken(userId);
    const resetToken = await mintToken(getTestDb(), userId, "password_reset");

    const response = await changePOST(changeReq(callerToken));
    expect(response.status).toBe(204);

    const replacement = response.cookies.get("cuadre_session")!.value;
    expect((await me(replacement)).status).toBe(200); // caller survives
    expect((await me(callerToken)).status).toBe(401); // the token it sent does not
    expect((await me(otherSession)).status).toBe(401); // every other session is out

    // The reset link that existed before the change is gone.
    const reset = await resetPOST(
      new NextRequest(`${APP_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: APP_URL, "cf-connecting-ip": "203.0.113.62" },
        body: JSON.stringify({ token: resetToken, password: "yet another passphrase" }),
      }),
    );
    expect(reset.status).toBe(400);
  });
});
