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
vi.mock("../mail", () => ({
  isMailConfigured: isMailConfiguredMock,
  sendMail: sendMailMock,
}));

describe.skipIf(!hasTestDatabase)("email verification service", () => {
  setupTestDb();

  let sendVerificationEmail: typeof import("./email-verification").sendVerificationEmail;
  let resendVerification: typeof import("./email-verification").resendVerification;
  let UnauthorizedError: typeof import("../errors").UnauthorizedError;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");
    ({ sendVerificationEmail, resendVerification } = await import("./email-verification"));
    ({ UnauthorizedError } = await import("../errors"));
  });

  afterAll(() => vi.unstubAllEnvs());
  afterEach(() => {
    isMailConfiguredMock.mockReturnValue(true);
    sendMailMock.mockReset();
    sendMailMock.mockResolvedValue(undefined);
  });

  async function seedUser(verified = false) {
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

  function tokensFor(userId: string) {
    return getTestDb().select().from(authTokens).where(eq(authTokens.userId, userId));
  }

  describe("sendVerificationEmail", () => {
    it("mints an email_verify token and mails a /verify-email link to the address", async () => {
      const user = await seedUser();

      await sendVerificationEmail(user.id, user.email);

      const rows = await tokensFor(user.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.purpose).toBe("email_verify");

      expect(sendMailMock).toHaveBeenCalledOnce();
      const [message] = sendMailMock.mock.calls[0]!;
      expect(message.to).toBe(user.email);
      expect(message.text).toContain("http://localhost:3000/verify-email/");
      expect(message.html).toContain("/verify-email/");
      // Nothing but the link — no remote asset, no tracking pixel, and the
      // only URLs are the app's own verification link.
      expect(message.html).not.toContain("<img");
      expect(message.html.match(/https?:\/\/[^"'\s]+/g) ?? []).toEqual(
        expect.arrayContaining([expect.stringContaining("http://localhost:3000/verify-email/")]),
      );
      for (const url of message.html.match(/https?:\/\/[^"'\s]+/g) ?? []) {
        expect(url).toContain("http://localhost:3000/verify-email/");
      }
    });

    it("does nothing when mail is unconfigured — no token, no send", async () => {
      isMailConfiguredMock.mockReturnValue(false);
      const user = await seedUser();

      await sendVerificationEmail(user.id, user.email);

      expect(await tokensFor(user.id)).toHaveLength(0);
      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it("swallows a send failure — resolves, does not throw", async () => {
      sendMailMock.mockRejectedValue(new Error("smtp exploded"));
      const user = await seedUser();

      await expect(sendVerificationEmail(user.id, user.email)).resolves.toBeUndefined();
    });

    it("invalidates the previous email_verify token on a re-send", async () => {
      const user = await seedUser();
      await sendVerificationEmail(user.id, user.email);
      const first = (await tokensFor(user.id))[0]!.tokenHash;

      await sendVerificationEmail(user.id, user.email);

      const rows = await tokensFor(user.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.tokenHash).not.toBe(first);
    });
  });

  describe("resendVerification", () => {
    it("sends for an unverified account", async () => {
      const user = await seedUser(false);
      await resendVerification(user.id);
      expect(sendMailMock).toHaveBeenCalledOnce();
    });

    it("sends nothing for an already-verified account, without erroring", async () => {
      const user = await seedUser(true);
      await expect(resendVerification(user.id)).resolves.toBeUndefined();
      expect(sendMailMock).not.toHaveBeenCalled();
      expect(await tokensFor(user.id)).toHaveLength(0);
    });

    it("throws UnauthorizedError for a user that doesn't exist", async () => {
      await expect(resendVerification(crypto.randomUUID())).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });
});
