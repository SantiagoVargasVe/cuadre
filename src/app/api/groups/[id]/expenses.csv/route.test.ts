import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../../../../test/db";

const APP_URL = "http://localhost:3000";
const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("GET /api/groups/[id]/expenses.csv", () => {
  setupTestDb();

  let GET: typeof import("./route").GET;
  let token: string;
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
    ({ GET } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ users }, { signSessionToken }, { createGroup }] = await Promise.all([
      import("../../../../../server/db/schema"),
      import("../../../../../server/auth/jwt"),
      import("../../../../../server/services/groups"),
    ]);
    const [user, outsider] = await getTestDb().insert(users).values([
      {
      email: `${crypto.randomUUID()}@example.com`, displayName: "Ana", passwordHash: "x",
      },
      {
        email: `${crypto.randomUUID()}@example.com`, displayName: "Nadie", passwordHash: "x",
      },
    ]).returning();
    token = await signSessionToken(user!.id);
    outsiderToken = await signSessionToken(outsider!.id);
    groupId = (await createGroup(user!.id, { title: "Cartagena 2026" })).id;
  });

  it("returns a UTF-8 CSV attachment with the canonical header", async () => {
    const response = await GET(new NextRequest(`${APP_URL}/api/groups/${groupId}/expenses.csv`, {
      headers: { authorization: `Bearer ${token}` },
    }), { params: Promise.resolve({ id: groupId }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="cartagena-2026-gastos-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(await response.text()).toBe(
      "expense_id,date,title,amount_minor,currency,split_strategy,payers,splits,created_at,updated_at\r\n",
    );
  });

  it("returns 404 for a non-member rather than an empty export", async () => {
    const response = await GET(new NextRequest(`${APP_URL}/api/groups/${groupId}/expenses.csv`, {
      headers: { authorization: `Bearer ${outsiderToken}` },
    }), { params: Promise.resolve({ id: groupId }) });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "NOT_A_MEMBER" } });
  });
});
