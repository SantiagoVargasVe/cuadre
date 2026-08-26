import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("/api/groups/[id]/members/[userId]", () => {
  setupTestDb();

  let memberDELETE: typeof import("./route").DELETE;
  let ownerToken: string;
  let memberToken: string;
  let groupId: string;
  let betoId: string;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ DELETE: memberDELETE } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ users, groupMembers }, { signSessionToken }, { createGroup }] = await Promise.all([
      import("../../../../../../server/db/schema"),
      import("../../../../../../server/auth/jwt"),
      import("../../../../../../server/services/groups"),
    ]);
    const [owner] = await getTestDb()
      .insert(users)
      .values({ email: "ana@example.com", displayName: "Ana", passwordHash: "x" })
      .returning();
    const [beto] = await getTestDb()
      .insert(users)
      .values({ email: "beto@example.com", displayName: "Beto", passwordHash: "x" })
      .returning();
    betoId = beto!.id;
    ownerToken = await signSessionToken(owner!.id);
    memberToken = await signSessionToken(beto!.id);
    groupId = (await createGroup(owner!.id, { title: "Cartagena 2026" })).id;
    await getTestDb().insert(groupMembers).values({ groupId, userId: betoId, role: "member" });
  });

  function ctx() {
    return { params: Promise.resolve({ id: groupId, userId: betoId }) };
  }

  function req(token: string) {
    return new NextRequest(`${APP_URL}/api/groups/${groupId}/members/${betoId}`, {
      method: "DELETE",
      headers: { origin: APP_URL, authorization: `Bearer ${token}` },
    });
  }

  it("owner removes a zero-balance member and gets 204", async () => {
    const response = await memberDELETE(req(ownerToken), ctx());
    expect(response.status).toBe(204);
  });

  it("403s a non-owner", async () => {
    const response = await memberDELETE(req(memberToken), ctx());
    expect(response.status).toBe(403);
  });

  it("403s with no Origin and no Bearer", async () => {
    const response = await memberDELETE(
      new NextRequest(`${APP_URL}/api/groups/${groupId}/members/${betoId}`, { method: "DELETE" }),
      ctx(),
    );
    expect(response.status).toBe(403);
  });
});
