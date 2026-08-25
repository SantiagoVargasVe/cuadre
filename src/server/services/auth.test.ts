import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("register — DB errors other than a unique violation", () => {
  setupTestDb();

  let register: typeof import("./auth").register;
  let EmailAlreadyRegisteredError: typeof import("./auth").EmailAlreadyRegisteredError;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ register, EmailAlreadyRegisteredError } = await import("./auth"));
  });

  afterAll(() => vi.unstubAllEnvs());

  it("re-throws an unrelated constraint violation as-is, not as EmailAlreadyRegisteredError", async () => {
    const { inviteCodes } = await import("../db/schema");
    await getTestDb().insert(inviteCodes).values({ code: "some-code" });

    const error = await register({
      email: "valid@example.com",
      // Forces a NOT NULL violation (23502), not a unique violation
      // (23505) — proves the catch block only special-cases the one
      // error it's meant to, and doesn't mask everything else as
      // "email already registered".
      displayName: null as unknown as string,
      password: "correct horse battery staple",
      inviteCode: "some-code",
    }).catch((caught: unknown) => caught);

    expect(error).not.toBeInstanceOf(EmailAlreadyRegisteredError);
  });
});
