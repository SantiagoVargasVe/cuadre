import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("GET /api/invites/[code]", () => {
  setupTestDb();

  let inviteGET: typeof import("./route").GET;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ GET: inviteGET } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  function ctx(code: string) {
    return { params: Promise.resolve({ code }) };
  }

  it("is unauthenticated and returns valid:false for an unknown code", async () => {
    const response = await inviteGET(
      new NextRequest(`${APP_URL}/api/invites/no-such-code`),
      ctx("no-such-code"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ valid: false });
  });

  it("returns exactly groupTitle, inviterName, and valid for a live invite", async () => {
    const [{ users, groups, inviteCodes }] = await Promise.all([
      import("../../../../server/db/schema"),
    ]);
    const [owner] = await getTestDb()
      .insert(users)
      .values({ email: "ana@example.com", displayName: "Ana", passwordHash: "x" })
      .returning();
    const [group] = await getTestDb()
      .insert(groups)
      .values({ title: "Cartagena 2026", defaultCurrency: "COP", createdBy: owner!.id })
      .returning();
    await getTestDb()
      .insert(inviteCodes)
      .values({ code: "route-lookup-1", groupId: group!.id, createdBy: owner!.id });

    const response = await inviteGET(
      new NextRequest(`${APP_URL}/api/invites/route-lookup-1`),
      ctx("route-lookup-1"),
    );

    expect(await response.json()).toEqual({
      valid: true,
      groupTitle: "Cartagena 2026",
      inviterName: "Ana",
    });
  });
});
