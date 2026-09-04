import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("POST /api/auth/register", () => {
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

  async function seedInvite(code: string, extra: Record<string, unknown> = {}) {
    const { inviteCodes } = await import("../../../../server/db/schema");
    await getTestDb().insert(inviteCodes).values({ code, ...extra });
  }

  beforeEach(async () => {
    await seedInvite("valid-invite");
  });

  function request(body: unknown, headers: Record<string, string> = {}) {
    return new NextRequest(`${APP_URL}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP_URL, ...headers },
      body: JSON.stringify(body),
    });
  }

  const validBody = {
    email: "ana@example.com",
    displayName: "Ana",
    password: "correct horse battery staple",
    inviteCode: "valid-invite",
    termsAccepted: true,
    privacyAccepted: true,
  };

  it("registers, consumes the code, and sets the session cookie", async () => {
    const response = await registerPOST(request(validBody));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.user.email).toBe(validBody.email);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("cuadre_session=");

    const { inviteCodes } = await import("../../../../server/db/schema");
    const [invite] = await getTestDb().select().from(inviteCodes).limit(1);
    expect(invite?.consumedBy).toBe(body.user.id);
  });

  it("rejects a duplicate email with 409, distinct from an invalid invite", async () => {
    await registerPOST(request(validBody));
    await seedInvite("second-invite");

    const response = await registerPOST(
      request({ ...validBody, inviteCode: "second-invite" }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it.each([
    ["a code that doesn't exist", "no-such-code"],
    ["an already-consumed code", "consumed-invite"],
    ["an expired code", "expired-invite"],
  ])("rejects registration with %s — same body as any invalid invite", async (_label, code) => {
    if (code === "consumed-invite") {
      await seedInvite(code);
      await registerPOST(request({ ...validBody, email: "someone-else@example.com", inviteCode: code }));
    }
    if (code === "expired-invite") {
      await seedInvite(code, { expiresAt: new Date(Date.now() - 60_000) });
    }

    const response = await registerPOST(
      request({ ...validBody, email: "fresh@example.com", inviteCode: code }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("INVALID_INVITE_CODE");
  });

  it("rejects a password shorter than the minimum", async () => {
    const response = await registerPOST(request({ ...validBody, password: "short" }));
    expect(response.status).toBe(400);
  });

  it("rejects registration with no Origin header and no Bearer token", async () => {
    const response = await registerPOST(
      new NextRequest(`${APP_URL}/api/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );

    expect(response.status).toBe(403);
  });
});
