import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("POST /api/groups/[id]/archive", () => {
  setupTestDb();

  let archivePOST: typeof import("./route").POST;
  let ownerToken: string;
  let memberToken: string;
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

    ({ POST: archivePOST } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ users, groupMembers }, { signSessionToken }, { createGroup }] = await Promise.all([
      import("../../../../../server/db/schema"),
      import("../../../../../server/auth/jwt"),
      import("../../../../../server/services/groups"),
    ]);
    const [owner] = await getTestDb()
      .insert(users)
      .values({ email: "ana@example.com", displayName: "Ana", passwordHash: "x" })
      .returning();
    const [member] = await getTestDb()
      .insert(users)
      .values({ email: "beto@example.com", displayName: "Beto", passwordHash: "x" })
      .returning();
    ownerToken = await signSessionToken(owner!.id);
    memberToken = await signSessionToken(member!.id);
    groupId = (await createGroup(owner!.id, { title: "Cartagena 2026" })).id;
    await getTestDb().insert(groupMembers).values({ groupId, userId: member!.id, role: "member" });
  });

  function ctx() {
    return { params: Promise.resolve({ id: groupId }) };
  }

  function req(token: string) {
    return new NextRequest(`${APP_URL}/api/groups/${groupId}/archive`, {
      method: "POST",
      headers: { origin: APP_URL, authorization: `Bearer ${token}` },
    });
  }

  it("404s for a non-member", async () => {
    const [{ users }, { signSessionToken }] = await Promise.all([
      import("../../../../../server/db/schema"),
      import("../../../../../server/auth/jwt"),
    ]);
    const [outsider] = await getTestDb()
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Nadie", passwordHash: "x" })
      .returning();
    const outsiderToken = await signSessionToken(outsider!.id);
    const response = await archivePOST(req(outsiderToken), ctx());
    expect(response.status).toBe(404);
  });

  it("403s for a member who isn't owner", async () => {
    const response = await archivePOST(req(memberToken), ctx());
    expect(response.status).toBe(403);
  });

  it("archives the group for the owner", async () => {
    const response = await archivePOST(req(ownerToken), ctx());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.group.archivedAt).not.toBeNull();
  });
});
