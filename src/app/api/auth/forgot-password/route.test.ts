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

describe.skipIf(!hasTestDatabase)("POST /api/auth/forgot-password", () => {
  setupTestDb();

  let forgotPOST: typeof import("./route").POST;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");
    ({ POST: forgotPOST } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());
  afterEach(() => {
    isMailConfiguredMock.mockReturnValue(true);
    sendMailMock.mockReset();
    sendMailMock.mockResolvedValue(undefined);
  });

  async function seedUser(email: string, verified = true) {
    const { users } = await import("../../../../server/db/schema");
    await getTestDb()
      .insert(users)
      .values({
        email,
        displayName: "Ana",
        passwordHash: "x",
        emailVerifiedAt: verified ? new Date() : null,
      });
  }

  function req(email: string, ip = "203.0.113.9") {
    return new NextRequest(`${APP_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP_URL, "cf-connecting-ip": ip },
      body: JSON.stringify({ email }),
    });
  }

  async function bodyBytes(response: Response) {
    return { status: response.status, text: await response.text() };
  }

  it("returns a byte-identical 202 for known, unknown, and unverified addresses", async () => {
    await seedUser("verified@example.com", true);
    await seedUser("unverified@example.com", false);

    const known = await bodyBytes(await forgotPOST(req("verified@example.com", "203.0.113.1")));
    const unknown = await bodyBytes(await forgotPOST(req("nobody@example.com", "203.0.113.2")));
    const unverified = await bodyBytes(await forgotPOST(req("unverified@example.com", "203.0.113.3")));

    expect(known).toEqual({ status: 202, text: "" });
    expect(unknown).toEqual(known);
    expect(unverified).toEqual(known);
  });

  it("still returns 202 when the mail send fails", async () => {
    sendMailMock.mockRejectedValue(new Error("smtp exploded"));
    await seedUser("boom@example.com", true);

    const response = await forgotPOST(req("boom@example.com", "203.0.113.4"));
    expect(response.status).toBe(202);
  });

  it("429s when the per-IP bucket is exhausted", async () => {
    let last = await forgotPOST(req("a@example.com", "198.51.100.7"));
    for (let i = 0; i < 3; i++) last = await forgotPOST(req(`a${i}@example.com`, "198.51.100.7"));
    expect(last.status).toBe(429);
    expect(last.headers.get("Retry-After")).toBeTruthy();
  });

  it("429s when the per-address bucket is exhausted, even from fresh IPs", async () => {
    let last = await forgotPOST(req("target@example.com", "198.51.100.10"));
    for (let i = 0; i < 3; i++) last = await forgotPOST(req("target@example.com", `198.51.100.${20 + i}`));
    expect(last.status).toBe(429);
  });

  it("rejects a request with no Origin and no Bearer", async () => {
    const response = await forgotPOST(
      new NextRequest(`${APP_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "x@example.com" }),
      }),
    );
    expect(response.status).toBe(403);
  });
});
