import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../test/db";
import { authTokens, users } from "../db/schema";
import type { MailMessage } from "../mail";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

const { isMailConfiguredMock, sendMailMock } = vi.hoisted(() => ({
  isMailConfiguredMock: vi.fn<() => boolean>(() => true),
  sendMailMock: vi.fn<(message: MailMessage) => Promise<void>>(async () => {}),
}));
vi.mock("../mail", () => ({ isMailConfigured: isMailConfiguredMock, sendMail: sendMailMock }));

/**
 * `requestPasswordReset` returns nothing observable — every route path is
 * an identical 202 — so what's asserted here is the side effects: whether
 * a token is minted and whether mail is attempted, across the four cases.
 */
describe.skipIf(!hasTestDatabase)("requestPasswordReset", () => {
  setupTestDb();

  let requestPasswordReset: typeof import("./password-reset").requestPasswordReset;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");
    ({ requestPasswordReset } = await import("./password-reset"));
  });

  afterAll(() => vi.unstubAllEnvs());
  afterEach(() => {
    isMailConfiguredMock.mockReturnValue(true);
    sendMailMock.mockReset();
    sendMailMock.mockResolvedValue(undefined);
  });

  async function seedUser(verified: boolean) {
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

  function resetTokens(userId: string) {
    return getTestDb()
      .select()
      .from(authTokens)
      .where(eq(authTokens.userId, userId));
  }

  it("mints nothing and sends nothing for an unknown address", async () => {
    await requestPasswordReset("stranger@example.com");
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(await getTestDb().select().from(authTokens)).toHaveLength(0);
  });

  it("mints nothing and sends nothing for an unverified address (the gate)", async () => {
    const user = await seedUser(false);
    await requestPasswordReset(user.email);
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(await resetTokens(user.id)).toHaveLength(0);
  });

  it("mints a password_reset token and mails a /reset-password link for a verified address", async () => {
    const user = await seedUser(true);

    await requestPasswordReset(user.email);

    const rows = await resetTokens(user.id);
    expect(rows.map((r) => r.purpose)).toEqual(["password_reset"]);
    expect(sendMailMock).toHaveBeenCalledOnce();
    expect(sendMailMock.mock.calls[0]![0].to).toBe(user.email);
    expect(sendMailMock.mock.calls[0]![0].text).toContain("http://localhost:3000/reset-password/");
  });

  it("mints the token but sends nothing when mail is unconfigured", async () => {
    isMailConfiguredMock.mockReturnValue(false);
    const user = await seedUser(true);

    await requestPasswordReset(user.email);

    expect(await resetTokens(user.id)).toHaveLength(1);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("swallows a send failure — resolves, token still minted", async () => {
    sendMailMock.mockRejectedValue(new Error("smtp exploded"));
    const user = await seedUser(true);

    await expect(requestPasswordReset(user.email)).resolves.toBeUndefined();
    expect(await resetTokens(user.id)).toHaveLength(1);
  });
});
