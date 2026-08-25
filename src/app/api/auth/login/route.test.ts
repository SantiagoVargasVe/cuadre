import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";
const EMAIL = "ana@example.com";
const PASSWORD = "correct horse battery staple";

describe.skipIf(!hasTestDatabase)("POST /api/auth/login", () => {
  setupTestDb();

  let loginPOST: typeof import("./route").POST;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ POST: loginPOST } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  // setupTestDb() truncates every table after each test, so the fixture
  // user has to be recreated before each one rather than once in beforeAll.
  beforeEach(async () => {
    const [{ users }, { hashPassword }] = await Promise.all([
      import("../../../../server/db/schema"),
      import("../../../../server/auth/password"),
    ]);
    await getTestDb()
      .insert(users)
      .values({ email: EMAIL, displayName: "Ana", passwordHash: await hashPassword(PASSWORD) });
  });

  function request(body: unknown, headers: Record<string, string> = {}) {
    return new NextRequest(`${APP_URL}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP_URL, ...headers },
      body: JSON.stringify(body),
    });
  }

  it("logs in with correct credentials and sets the session cookie", async () => {
    const response = await loginPOST(request({ email: EMAIL, password: PASSWORD }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.email).toBe(EMAIL);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("cuadre_session=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("rejects a wrong password and an unknown email with the identical body", async () => {
    const wrongPassword = await loginPOST(request({ email: EMAIL, password: "nope" }));
    const unknownEmail = await loginPOST(
      request({ email: "nobody@example.com", password: "nope" }),
    );

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
    expect(wrongPassword.headers.get("set-cookie")).toBeNull();
  });

  it("rejects login with no Origin header and no Bearer token", async () => {
    const response = await loginPOST(
      new NextRequest(`${APP_URL}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      }),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("rate limits repeated attempts before exhausting the Argon2 budget", async () => {
    let last: Response | undefined;
    for (let i = 0; i < 11; i++) {
      last = await loginPOST(request({ email: "probe@example.com", password: "nope" }));
    }

    expect(last?.status).toBe(429);
    expect(last?.headers.get("retry-after")).toBeTruthy();
  });
});
