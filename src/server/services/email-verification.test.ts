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

    it("mints nothing and sends nothing when mail is unconfigured, but WARNS", async () => {
      // The warn is the point (T132). Nothing here can tell the caller
      // anything — the route returns 204 either way — so this line is the
      // only evidence that verification is silently disabled. Its absence
      // is what made the 2026-09-04 outage invisible.
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      isMailConfiguredMock.mockReturnValue(false);
      const user = await seedUser();

      await sendVerificationEmail(user.id, user.email);

      // Deliberately no token: unlike a reset token, nothing can deliver a
      // verification link, so minting one would leave an unredeemable row.
      expect(await tokensFor(user.id)).toHaveLength(0);
      expect(sendMailMock).not.toHaveBeenCalled();

      expect(warn).toHaveBeenCalledOnce();
      const [message, context] = warn.mock.calls[0]!;
      expect(message).toContain("mail is not configured");
      expect(message).toContain("reset-link");
      expect(context).toEqual({ userId: user.id });
      // Never the address, and never a token.
      expect(JSON.stringify(warn.mock.calls[0])).not.toContain(user.email);
      warn.mockRestore();
    });

    it("swallows a send failure — resolves, does not throw, and logs it distinctly", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      sendMailMock.mockRejectedValue(new Error("smtp exploded"));
      const user = await seedUser();

      await expect(sendVerificationEmail(user.id, user.email)).resolves.toBeUndefined();

      // A different line from the unconfigured case: a dead API key and a
      // provider outage are different problems with different fixes, and a
      // shared message would defeat the only diagnostic there is.
      expect(error).toHaveBeenCalledOnce();
      const [message, context] = error.mock.calls[0]!;
      expect(message).toContain("failed to send");
      expect(message).not.toContain("not configured");
      expect(context).toMatchObject({ userId: user.id, error: "Error" });
      expect(JSON.stringify(error.mock.calls[0])).not.toContain(user.email);
      error.mockRestore();
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
