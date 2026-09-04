import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../test/db";
import { authTokens, inviteCodes, users } from "../db/schema";
import type { MailMessage } from "../mail";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

const { isMailConfiguredMock, sendMailMock } = vi.hoisted(() => ({
  isMailConfiguredMock: vi.fn<() => boolean>(() => true),
  sendMailMock: vi.fn<(message: MailMessage) => Promise<void>>(async () => {}),
}));
vi.mock("../mail", () => ({ isMailConfigured: isMailConfiguredMock, sendMail: sendMailMock }));

/**
 * The seam ADR-0013 is most explicit about: the verification message goes
 * out **after** the account transaction commits, and a mail failure —
 * including no mailer configured — never rolls it back.
 */
describe.skipIf(!hasTestDatabase)("register — verification email", () => {
  setupTestDb();

  let register: typeof import("./auth").register;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");
    ({ register } = await import("./auth"));
  });

  afterAll(() => vi.unstubAllEnvs());
  afterEach(() => {
    isMailConfiguredMock.mockReturnValue(true);
    sendMailMock.mockReset();
    sendMailMock.mockResolvedValue(undefined);
  });
  beforeEach(async () => {
    await getTestDb().insert(inviteCodes).values({ code: "verify-invite" });
  });

  const account = {
    email: "newbie@example.com",
    displayName: "Newbie",
    password: "correct horse battery staple",
    inviteCode: "verify-invite",
    termsAccepted: true as const,
    privacyAccepted: true as const,
  };

  it("creates the account unverified and mails a verification link after commit", async () => {
    const { user } = await register(account);

    const [row] = await getTestDb().select().from(users).where(eq(users.id, user.id));
    expect(row?.emailVerifiedAt).toBeNull();

    expect(sendMailMock).toHaveBeenCalledOnce();
    expect(sendMailMock.mock.calls[0]![0].to).toBe(account.email);
    const [tokenRow] = await getTestDb().select().from(authTokens).where(eq(authTokens.userId, user.id));
    expect(tokenRow?.purpose).toBe("email_verify");
  });

  it("still commits the registration when the mailer throws", async () => {
    sendMailMock.mockRejectedValue(new Error("smtp exploded"));

    const { user } = await register(account);

    expect((await getTestDb().select().from(users).where(eq(users.id, user.id)))[0]).toBeDefined();
    expect((await getTestDb().select().from(inviteCodes))[0]?.consumedAt).toBeInstanceOf(Date);
  });

  it("still commits the registration when mail is unconfigured, and sends nothing", async () => {
    isMailConfiguredMock.mockReturnValue(false);

    const { user } = await register(account);

    expect((await getTestDb().select().from(users).where(eq(users.id, user.id)))[0]).toBeDefined();
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(await getTestDb().select().from(authTokens)).toHaveLength(0);
  });
});
