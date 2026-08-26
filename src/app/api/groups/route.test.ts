import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("POST /api/groups", () => {
  setupTestDb();

  let groupsPOST: typeof import("./route").POST;
  let token: string;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ POST: groupsPOST } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ users }, { signSessionToken }] = await Promise.all([
      import("../../../server/db/schema"),
      import("../../../server/auth/jwt"),
    ]);
    const [user] = await getTestDb()
      .insert(users)
      .values({ email: "ana@example.com", displayName: "Ana", passwordHash: "x" })
      .returning();
    token = await signSessionToken(user!.id);
  });

  function request(body: unknown, headers: Record<string, string> = {}) {
    return new NextRequest(`${APP_URL}/api/groups`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP_URL, authorization: `Bearer ${token}`, ...headers },
      body: JSON.stringify(body),
    });
  }

  it("creates a group and returns 201", async () => {
    const response = await groupsPOST(request({ title: "Cartagena 2026" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.group.title).toBe("Cartagena 2026");
    expect(body.group.defaultCurrency).toBe("COP");
  });

  it("rejects with no session", async () => {
    const response = await groupsPOST(request({ title: "Trip" }, { authorization: "" }));
    expect(response.status).toBe(401);
  });

  it("rejects with no Origin and no Bearer", async () => {
    const response = await groupsPOST(
      new NextRequest(`${APP_URL}/api/groups`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Trip" }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("rejects a blank title", async () => {
    const response = await groupsPOST(request({ title: "" }));
    expect(response.status).toBe(400);
  });

  it("rejects an unsupported currency with 422", async () => {
    const response = await groupsPOST(request({ title: "Trip", defaultCurrency: "JPY" }));
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("CURRENCY_NOT_SUPPORTED");
  });
});
