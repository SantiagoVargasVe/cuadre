import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("/api/groups/[id]", () => {
  setupTestDb();

  let groupGET: typeof import("./route").GET;
  let groupPATCH: typeof import("./route").PATCH;
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

    ({ GET: groupGET, PATCH: groupPATCH } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ users }, { signSessionToken }, { createGroup }] = await Promise.all([
      import("../../../../server/db/schema"),
      import("../../../../server/auth/jwt"),
      import("../../../../server/services/groups"),
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

  function req(token: string, init: { method?: string; body?: string } = {}) {
    return new NextRequest(`${APP_URL}/api/groups/${groupId}`, {
      headers: { origin: APP_URL, authorization: `Bearer ${token}`, "content-type": "application/json" },
      method: init.method,
      body: init.body,
    });
  }

  describe("GET", () => {
    it("404s for a non-member", async () => {
      const response = await groupGET(req(outsiderToken), ctx());
      expect(response.status).toBe(404);
    });

    it("returns the group and members for a member", async () => {
      const response = await groupGET(req(ownerToken), ctx());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.group.id).toBe(groupId);
      expect(body.members).toEqual([{ userId: expect.any(String), displayName: "Ana", role: "owner", avatar: null }]);
    });
  });

  describe("PATCH", () => {
    it("404s for a non-member", async () => {
      const response = await groupPATCH(
        req(outsiderToken, { method: "PATCH", body: JSON.stringify({ title: "Nope" }) }),
        ctx(),
      );
      expect(response.status).toBe(404);
    });

    it("403s with no Origin and no Bearer", async () => {
      const response = await groupPATCH(
        new NextRequest(`${APP_URL}/api/groups/${groupId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Nope" }),
        }),
        ctx(),
      );
      expect(response.status).toBe(403);
    });

    it("lets any member rename the group", async () => {
      const response = await groupPATCH(
        req(ownerToken, { method: "PATCH", body: JSON.stringify({ title: "Renamed" }) }),
        ctx(),
      );
      expect(response.status).toBe(200);
      expect((await response.json()).group.title).toBe("Renamed");
    });
  });
});
