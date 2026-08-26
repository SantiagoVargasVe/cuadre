import { describe, expect, it } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { groups, inviteCodes, users } from "../db/schema";
import { consumeInvite, InvalidInviteError } from "./invites";

describe.skipIf(!hasTestDatabase)("consumeInvite", () => {
  setupTestDb();

  async function seedUser() {
    const [user] = await getTestDb()
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Ana", passwordHash: "x" })
      .returning();
    return user!.id;
  }

  async function seedGroup(createdBy: string) {
    const [group] = await getTestDb()
      .insert(groups)
      .values({ title: "Cartagena 2026", defaultCurrency: "COP", createdBy })
      .returning();
    return group!.id;
  }

  it("consumes an unconsumed, unexpired code and returns its groupId", async () => {
    const db = getTestDb();
    await db.insert(inviteCodes).values({ code: "plain-invite-1" });
    const userId = await seedUser();

    const result = await db.transaction((tx) => consumeInvite(tx, "plain-invite-1", userId));

    expect(result).toEqual({ groupId: null });
  });

  it("marks consumedBy and consumedAt on the row", async () => {
    const db = getTestDb();
    await db.insert(inviteCodes).values({ code: "plain-invite-2" });
    const userId = await seedUser();

    await db.transaction((tx) => consumeInvite(tx, "plain-invite-2", userId));

    const [row] = await db.select().from(inviteCodes).limit(1);
    expect(row?.consumedBy).toBe(userId);
    expect(row?.consumedAt).toBeInstanceOf(Date);
  });

  it("returns the groupId when the code carries one", async () => {
    const db = getTestDb();
    const userId = await seedUser();
    const groupId = await seedGroup(userId);
    await db.insert(inviteCodes).values({ code: "group-invite-1", groupId });

    const result = await db.transaction((tx) => consumeInvite(tx, "group-invite-1", userId));

    expect(result).toEqual({ groupId });
  });

  it("rejects a code that doesn't exist", async () => {
    const db = getTestDb();
    const userId = await seedUser();

    await expect(
      db.transaction((tx) => consumeInvite(tx, "no-such-code", userId)),
    ).rejects.toThrow(InvalidInviteError);
  });

  it("rejects an already-consumed code", async () => {
    const db = getTestDb();
    await db.insert(inviteCodes).values({ code: "already-used" });
    const firstUser = await seedUser();
    const secondUser = await seedUser();

    await db.transaction((tx) => consumeInvite(tx, "already-used", firstUser));

    await expect(
      db.transaction((tx) => consumeInvite(tx, "already-used", secondUser)),
    ).rejects.toThrow(InvalidInviteError);
  });

  it("rejects an expired code, indistinguishably from an already-used one", async () => {
    const db = getTestDb();
    await db.insert(inviteCodes).values({
      code: "expired-code",
      expiresAt: new Date(Date.now() - 60_000),
    });
    const userId = await seedUser();

    await expect(
      db.transaction((tx) => consumeInvite(tx, "expired-code", userId)),
    ).rejects.toThrow(InvalidInviteError);
  });

  it("accepts a code with a future expiry", async () => {
    const db = getTestDb();
    await db.insert(inviteCodes).values({
      code: "not-expired-code",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const userId = await seedUser();

    await expect(
      db.transaction((tx) => consumeInvite(tx, "not-expired-code", userId)),
    ).resolves.toEqual({ groupId: null });
  });
});
