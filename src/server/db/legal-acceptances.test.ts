import { describe, expect, it } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { legalAcceptances, users } from "./schema";

describe.skipIf(!hasTestDatabase)("legal_acceptances schema", () => {
  setupTestDb();

  it("keeps one immutable record per user, document, and version", async () => {
    const [user] = await getTestDb().insert(users).values({
      email: "acceptance@example.com",
      displayName: "Acceptance",
      passwordHash: "hash",
    }).returning();
    const acceptance = {
      userId: user!.id,
      document: "terms" as const,
      documentVersion: "2026-09-03",
      source: "registration" as const,
    };

    const [stored] = await getTestDb().insert(legalAcceptances).values(acceptance).returning();
    expect(stored?.acknowledgedAt).toBeInstanceOf(Date);
    await expect(getTestDb().insert(legalAcceptances).values(acceptance)).rejects.toThrow();

    await expect(getTestDb().insert(legalAcceptances).values({
      ...acceptance,
      documentVersion: "2027-01-01",
    })).resolves.toBeDefined();
  });
});
