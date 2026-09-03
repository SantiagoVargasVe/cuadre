import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

/** T115 — rejecting a malformed filter query, and who is allowed to run
 * one at all. What the filters *match* is the sibling `route.filters.test.ts`. */
describe.skipIf(!hasTestDatabase)("GET /api/groups/[id]/expenses — filter errors", () => {
  setupTestDb();

  let expensesGET: typeof import("./route").GET;
  let ownerToken: string;
  let outsiderToken: string;
  let betoToken: string;
  let betoId: string;
  let groupId: string;

  beforeAll(async () => {
    for (const [key, value] of Object.entries({
      APP_URL,
      DATABASE_URL: DATABASE_URL_TEST ?? "",
      AUTH_SECRET: "a".repeat(48),
      SUPPORTED_CURRENCIES: "COP,USD,EUR",
      DEFAULT_CURRENCY: "COP",
      FX_PROVIDER: "open-er-api",
      FX_BASE_CURRENCY: "USD",
      FX_TRM_CROSSCHECK: "true",
    })) {
      vi.stubEnv(key, value);
    }
    ({ GET: expensesGET } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ groupMembers, users }, { signSessionToken }, { createGroup }] = await Promise.all([
      import("../../../../../server/db/schema"),
      import("../../../../../server/auth/jwt"),
      import("../../../../../server/services/groups"),
    ]);
    const db = getTestDb();
    const [ana, beto, outsider] = await db
      .insert(users)
      .values([
        { email: "ana@example.com", displayName: "Ana", passwordHash: "x" },
        { email: "beto@example.com", displayName: "Beto", passwordHash: "x" },
        { email: "outsider@example.com", displayName: "Nadie", passwordHash: "x" },
      ])
      .returning();
    betoId = beto!.id;
    [ownerToken, betoToken, outsiderToken] = await Promise.all([
      signSessionToken(ana!.id),
      signSessionToken(betoId),
      signSessionToken(outsider!.id),
    ]);
    groupId = (await createGroup(ana!.id, { title: "Cartagena 2026" })).id;
    await db.insert(groupMembers).values({ groupId, userId: betoId, role: "member" });
  });

  function get(token: string, query = "") {
    return expensesGET(
      new NextRequest(`${APP_URL}/api/groups/${groupId}/expenses${query}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
      { params: Promise.resolve({ id: groupId }) },
    );
  }

  it("400s on malformed query input without naming the field that failed", async () => {
    for (const query of [
      "?category=fiesta",
      "?member=ana",
      "?currency=pesos",
      "?from=2026-02-31",
      "?from=2026-08-31&to=2026-08-01",
      "?sort=amount",
    ]) {
      const response = await get(ownerToken, query);
      expect(response.status, query).toBe(400);
      expect(await response.json()).toEqual({
        error: { code: "VALIDATION_ERROR", message: "Invalid query parameters" },
      });
    }
  });

  it("404s a filtered request from a non-member", async () => {
    expect((await get(outsiderToken, "?q=hotel")).status).toBe(404);
  });

  it("404s once the acting member has been removed from the group", async () => {
    const { groupMembers } = await import("../../../../../server/db/schema");
    await getTestDb()
      .update(groupMembers)
      .set({ removedAt: new Date() })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, betoId)));

    expect((await get(betoToken, `?member=${betoId}`)).status).toBe(404);
  });
});
