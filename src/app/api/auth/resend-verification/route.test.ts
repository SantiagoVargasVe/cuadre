import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../../../test/db";
import type { MailMessage } from "../../../../server/mail";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

const { isMailConfiguredMock, sendMailMock } = vi.hoisted(() => ({
  isMailConfiguredMock: vi.fn<() => boolean>(() => true),
  sendMailMock: vi.fn<(message: MailMessage) => Promise<void>>(async () => {}),
}));
vi.mock("../../../../server/mail", () => ({
  isMailConfigured: isMailConfiguredMock,
  sendMail: sendMailMock,
}));

describe.skipIf(!hasTestDatabase)("POST /api/auth/resend-verification", () => {
  setupTestDb();

  let resendPOST: typeof import("./route").POST;
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
    ({ POST: resendPOST } = await import("./route"));
    ({ signSessionToken } = await import("../../../../server/auth/jwt"));
  });

  afterAll(() => vi.unstubAllEnvs());
  afterEach(() => {
    isMailConfiguredMock.mockReturnValue(true);
    sendMailMock.mockReset();
    sendMailMock.mockResolvedValue(undefined);
  });

  async function seedUser(verified = false) {
    const { users } = await import("../../../../server/db/schema");
    const [user] = await getTestDb()
      .insert(users)
      .values({
        email: `${crypto.randomUUID()}@example.com`,
        displayName: "Ana",
        passwordHash: "x",
        emailVerifiedAt: verified ? new Date() : null,
      })
      .returning();
    return user!;
  }

  function req(token?: string) {
    return new NextRequest(`${APP_URL}/api/auth/resend-verification`, {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  }

  it("401s with no session", async () => {
    // Origin-checked first, so send an Origin to reach the auth check.
    const request = new NextRequest(`${APP_URL}/api/auth/resend-verification`, {
      method: "POST",
      headers: { origin: APP_URL },
    });
    expect((await resendPOST(request)).status).toBe(401);
  });

  it("403s with no Origin and no Bearer", async () => {
    expect((await resendPOST(req())).status).toBe(403);
  });

  it("mints a fresh token and mails the caller's address, returning 204", async () => {
    const { authTokens } = await import("../../../../server/db/schema");
    const user = await seedUser(false);

    const response = await resendPOST(req(await signSessionToken(user.id)));

    expect(response.status).toBe(204);
    expect(sendMailMock).toHaveBeenCalledOnce();
    expect(sendMailMock.mock.calls[0]![0].to).toBe(user.email);
    const rows = await getTestDb().select().from(authTokens).where(eq(authTokens.userId, user.id));
    expect(rows.map((r) => r.purpose)).toEqual(["email_verify"]);
  });

  it("returns 204 for an already-verified account and sends nothing", async () => {
    const user = await seedUser(true);

    const response = await resendPOST(req(await signSessionToken(user.id)));

    expect(response.status).toBe(204);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("returns 204 when mail is unconfigured", async () => {
    isMailConfiguredMock.mockReturnValue(false);
    const user = await seedUser(false);

    expect((await resendPOST(req(await signSessionToken(user.id)))).status).toBe(204);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("rate limits per user — the 4th call in a window is 429", async () => {
    const user = await seedUser(false);
    const token = await signSessionToken(user.id);

    let last = await resendPOST(req(token));
    for (let i = 0; i < 3; i++) last = await resendPOST(req(token));
    expect(last.status).toBe(429);
    expect(last.headers.get("Retry-After")).toBeTruthy();
  });
});
