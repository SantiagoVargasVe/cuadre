import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("GET /api/groups", () => {
  setupTestDb();

  let groupsGET: typeof import("./route").GET;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ GET: groupsGET } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  function request(bearer: string) {
    return new NextRequest(`${APP_URL}/api/groups`, { headers: { authorization: `Bearer ${bearer}` } });
  }

  it("lists only the groups you currently belong to, each with its own net", async () => {
    const [{ users }, { signSessionToken }, { createGroup }] = await Promise.all([
      import("../../../server/db/schema"),
      import("../../../server/auth/jwt"),
      import("../../../server/services/groups"),
    ]);
    const [ana] = await getTestDb()
      .insert(users)
      .values({ email: "ana@example.com", displayName: "Ana", passwordHash: "x" })
      .returning();
    const [beto] = await getTestDb()
      .insert(users)
      .values({ email: "beto@example.com", displayName: "Beto", passwordHash: "x" })
      .returning();
    const anaToken = await signSessionToken(ana!.id);
    await createGroup(ana!.id, { title: "Ana's trip" });
    await createGroup(beto!.id, { title: "Not Ana's trip" });

    const response = await groupsGET(request(anaToken));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([
      expect.objectContaining({ title: "Ana's trip", memberCount: 1, yourNet: [] }),
    ]);
  });

  it("rejects with no session", async () => {
    const response = await groupsGET(request(""));
    expect(response.status).toBe(401);
  });
});
