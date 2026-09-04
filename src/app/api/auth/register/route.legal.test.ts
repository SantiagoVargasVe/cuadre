import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CURRENT_LEGAL_DOCUMENTS } from "../../../../lib/legal";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";
const account = {
  email: "legal@example.com",
  displayName: "Legal",
  password: "correct horse battery staple",
  inviteCode: "legal-invite",
};
const validBody = { ...account, termsAccepted: true, privacyAccepted: true };

describe.skipIf(!hasTestDatabase)("POST /api/auth/register — legal acknowledgements", () => {
  setupTestDb();
  let registerPOST: typeof import("./route").POST;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");
    ({ POST: registerPOST } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());
  beforeEach(async () => {
    const { inviteCodes } = await import("../../../../server/db/schema");
    await getTestDb().insert(inviteCodes).values({ code: account.inviteCode });
  });

  function request(body: unknown) {
    return new NextRequest(`${APP_URL}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP_URL },
      body: JSON.stringify(body),
    });
  }

  it.each([
    ["missing Terms", { ...account, privacyAccepted: true }],
    ["false Terms", { ...validBody, termsAccepted: false }],
    ["missing Privacy", { ...account, termsAccepted: true }],
    ["false Privacy", { ...validBody, privacyAccepted: false }],
  ])("rejects %s without creating an account or consuming the invite", async (_label, body) => {
    const response = await registerPOST(request(body));
    const { inviteCodes, legalAcceptances, users } = await import("../../../../server/db/schema");

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(await getTestDb().select().from(users)).toHaveLength(0);
    expect(await getTestDb().select().from(legalAcceptances)).toHaveLength(0);
    expect((await getTestDb().select().from(inviteCodes))[0]?.consumedAt).toBeNull();
  });

  it("records exactly the current two versions using server-owned values", async () => {
    const before = Date.now();
    const response = await registerPOST(request({
      ...validBody,
      acknowledgedAt: "2000-01-01T00:00:00Z",
      source: "legacy_backfill",
      termsVersion: "attacker-version",
    }));
    const body = await response.json();
    const after = Date.now();
    const { legalAcceptances } = await import("../../../../server/db/schema");
    const rows = await getTestDb().select().from(legalAcceptances)
      .where(eq(legalAcceptances.userId, body.user.id));

    expect(response.status).toBe(201);
    expect(rows).toHaveLength(2);
    expect(rows.map(({ document, documentVersion, source }) => ({ document, documentVersion, source })))
      .toEqual(expect.arrayContaining(CURRENT_LEGAL_DOCUMENTS.map(({ document, version }) => ({
        document,
        documentVersion: version,
        source: "registration",
      }))));
    for (const row of rows) {
      expect(row.acknowledgedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(row.acknowledgedAt.getTime()).toBeLessThanOrEqual(after);
    }
  });

  it("rolls the user and acknowledgement rows back when invite consumption fails", async () => {
    const response = await registerPOST(request({ ...validBody, inviteCode: "missing-invite" }));
    const { legalAcceptances, users } = await import("../../../../server/db/schema");

    expect(response.status).toBe(409);
    expect(await getTestDb().select().from(users)).toHaveLength(0);
    expect(await getTestDb().select().from(legalAcceptances)).toHaveLength(0);
  });
});
