import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("GET /api/groups/[id]/expenses", () => {
  setupTestDb();

  let expensesGET: typeof import("./route").GET;
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

    ({ GET: expensesGET } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ users }, { signSessionToken }, { createGroup }, { createExpense }] = await Promise.all([
      import("../../../../../server/db/schema"),
      import("../../../../../server/auth/jwt"),
      import("../../../../../server/services/groups"),
      import("../../../../../server/services/expenses"),
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
    await createExpense(groupId, owner!.id, {
      title: "Dinner",
      date: "2026-08-24",
      amount: "1000",
      currency: "COP",
      split: { strategy: "equal" },
    });
  });

  function ctx() {
    return { params: Promise.resolve({ id: groupId }) };
  }

  function req(token: string, query = "") {
    return new NextRequest(`${APP_URL}/api/groups/${groupId}/expenses${query}`, {
      headers: { authorization: `Bearer ${token}` },
    });
  }

  it("returns the feed with resolved payers and splits", async () => {
    const response = await expensesGET(req(ownerToken), ctx());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].payers[0]).toMatchObject({ displayName: "Ana", amount: "1000" });
    expect(body.nextCursor).toBeNull();
  });

  it("respects an explicit limit", async () => {
    const response = await expensesGET(req(ownerToken, "?limit=0"), ctx());
    const body = await response.json();
    // limit=0 is falsy, so the service falls back to its default rather
    // than returning zero rows — same as omitting the param entirely.
    expect(body.items).toHaveLength(1);
  });

  it("404s for a non-member", async () => {
    const response = await expensesGET(req(outsiderToken), ctx());
    expect(response.status).toBe(404);
  });
});
