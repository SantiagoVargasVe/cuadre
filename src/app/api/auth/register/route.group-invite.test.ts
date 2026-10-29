import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../../../test/db";
import { groupMembers, users } from "../../../../server/db/schema";

const APP_URL = "http://localhost:3000";
const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("shared invite HTTP onboarding", () => {
  setupTestDb();
  let registerPOST: typeof import("./route").POST;
  let acceptPOST: typeof import("../../invites/[code]/accept/route").POST;
  let createGroup: typeof import("../../../../server/services/groups").createGroup;
  let createInvite: typeof import("../../../../server/services/invites").createInvite;
  let signSessionToken: typeof import("../../../../server/auth/jwt").signSessionToken;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR,GTQ");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "false");
    ({ POST: registerPOST } = await import("./route"));
    ({ POST: acceptPOST } = await import("../../invites/[code]/accept/route"));
    ({ createGroup } = await import("../../../../server/services/groups"));
    ({ createInvite } = await import("../../../../server/services/invites"));
    ({ signSessionToken } = await import("../../../../server/auth/jwt"));
  });
  afterAll(() => vi.unstubAllEnvs());

  it("the same URL admits an existing friend and registers two other friends with group memberships", async () => {
    const members = await getTestDb().insert(users).values([
      { email: "ana@example.com", displayName: "Ana", passwordHash: "x" },
      { email: "beto@example.com", displayName: "Beto", passwordHash: "x" },
    ]).returning();
    const group = await createGroup(members[0]!.id, { title: "Guatemala" });
    const { code } = await createInvite(group.id, members[0]!.id);
    const token = await signSessionToken(members[1]!.id);
    const existing = await acceptPOST(new NextRequest(`${APP_URL}/api/invites/${code}/accept`, {
      method: "POST", headers: { origin: APP_URL, authorization: `Bearer ${token}` },
    }), { params: Promise.resolve({ code }) });
    expect(existing.status).toBe(200);
    expect((await existing.json()).group.id).toBe(group.id);

    const register = (email: string) => registerPOST(new NextRequest(`${APP_URL}/api/auth/register`, {
      method: "POST", headers: { origin: APP_URL, "content-type": "application/json" },
      body: JSON.stringify({ email, displayName: "Amigo", password: "correct horse battery staple",
        inviteCode: code, termsAccepted: true, privacyAccepted: true }),
    }));
    const results = await Promise.all([register("caro@example.com"), register("dani@example.com")]);
    for (const response of results) {
      expect(response.status).toBe(201);
      expect(response.headers.get("set-cookie")).toBeTruthy();
      const { user } = await response.json();
      const memberships = await getTestDb().select().from(groupMembers).where(eq(groupMembers.userId, user.id));
      expect(memberships).toEqual([expect.objectContaining({ groupId: group.id, role: "member" })]);
    }
    expect(await getTestDb().select().from(groupMembers).where(eq(groupMembers.groupId, group.id))).toHaveLength(4);
  });
});
