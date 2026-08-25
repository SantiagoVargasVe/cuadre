import { describe, expect, it } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { inviteCodes, users } from "./schema";

describe.skipIf(!hasTestDatabase)("users / invite_codes schema", () => {
  setupTestDb();

  it("inserts and reads back a user", async () => {
    const db = getTestDb();

    const [user] = await db
      .insert(users)
      .values({ email: "ana@example.com", displayName: "Ana", passwordHash: "hash" })
      .returning();

    expect(user?.email).toBe("ana@example.com");
    expect(user?.id).toBeTruthy();
  });

  it("enforces email uniqueness case-insensitively via citext", async () => {
    const db = getTestDb();

    await db
      .insert(users)
      .values({ email: "Ana@Example.com", displayName: "Ana", passwordHash: "hash" });

    await expect(
      db
        .insert(users)
        .values({ email: "ana@example.com", displayName: "Ana Again", passwordHash: "hash" }),
    ).rejects.toThrow();
  });

  it("mints a bootstrap invite with no creator and no group yet", async () => {
    const db = getTestDb();

    const [invite] = await db.insert(inviteCodes).values({ code: "bootstrap12345" }).returning();

    expect(invite?.createdBy).toBeNull();
    expect(invite?.groupId).toBeNull();
    expect(invite?.consumedAt).toBeNull();
  });

  it("stores a group_id even though there is no groups table yet", async () => {
    const db = getTestDb();
    const groupId = "00000000-0000-0000-0000-000000000000";

    const [invite] = await db
      .insert(inviteCodes)
      .values({ code: "groupinvite1234", groupId })
      .returning();

    expect(invite?.groupId).toBe(groupId);
  });
});
