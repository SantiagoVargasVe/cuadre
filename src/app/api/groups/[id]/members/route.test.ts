import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("/api/groups/[id]/members", () => {
  setupTestDb();

  let membersGET: typeof import("./route").GET;
  let ownerToken: string;
  let outsiderToken: string;
  let groupId: string;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ GET: membersGET } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ users }, { signSessionToken }, { createGroup }] = await Promise.all([
      import("../../../../../server/db/schema"),
      import("../../../../../server/auth/jwt"),
      import("../../../../../server/services/groups"),
    ]);
    const [owner] = await getTestDb()
      .insert(users)
      .values({ email: "ana@example.com", displayName: "Ana", passwordHash: "x" })
      .returning();
    const [outsider] = await getTestDb()
      .insert(users)
      .values({ email: "outsider@example.com", displayName: "Nadie", passwordHash: "x" })
      .returning();
    ownerToken = await signSessionToken(owner!.id);
    outsiderToken = await signSessionToken(outsider!.id);
    groupId = (await createGroup(owner!.id, { title: "Cartagena 2026" })).id;
  });

  function ctx() {
    return { params: Promise.resolve({ id: groupId }) };
  }

  function req(token: string) {
    return new NextRequest(`${APP_URL}/api/groups/${groupId}/members`, {
      headers: { authorization: `Bearer ${token}` },
    });
  }

  it("returns members without email addresses", async () => {
    const response = await membersGET(req(ownerToken), ctx());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.members).toEqual([
      expect.objectContaining({ role: "owner", displayName: "Ana" }),
    ]);
    expect(JSON.stringify(body)).not.toContain("ana@example.com");
  });

  it("404s for a non-member", async () => {
    const response = await membersGET(req(outsiderToken), ctx());
    expect(response.status).toBe(404);
  });
});
