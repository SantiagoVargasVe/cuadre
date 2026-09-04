import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { authTokens, currencies, groupMembers, groups, inviteCodes, users } from "./schema";

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

  it("rejects a group_id that doesn't reference a real group", async () => {
    const db = getTestDb();
    const groupId = "00000000-0000-0000-0000-000000000000";

    await expect(
      db.insert(inviteCodes).values({ code: "groupinvite1234", groupId }),
    ).rejects.toThrow();
  });
});

describe.skipIf(!hasTestDatabase)("currencies / groups / group_members schema", () => {
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
    return group!;
  }

  it("seeds COP, USD, EUR by migration", async () => {
    const rows = await getTestDb().select().from(currencies);

    expect(rows).toEqual(
      expect.arrayContaining([
        { code: "COP", exponent: 2, displayDecimals: 0, name: "Colombian Peso" },
        { code: "USD", exponent: 2, displayDecimals: 2, name: "US Dollar" },
        { code: "EUR", exponent: 2, displayDecimals: 2, name: "Euro" },
      ]),
    );
  });

  it("creates a group with a null display currency and simplify_debts off by default", async () => {
    const userId = await seedUser();

    const group = await seedGroup(userId);

    expect(group.defaultCurrency).toBe("COP");
    expect(group.displayCurrency).toBeNull();
    expect(group.simplifyDebts).toBe(false);
    expect(group.archivedAt).toBeNull();
  });

  it("rejects a group with an unsupported default currency", async () => {
    const userId = await seedUser();

    await expect(
      getTestDb().insert(groups).values({ title: "Trip", defaultCurrency: "XXX", createdBy: userId }),
    ).rejects.toThrow();
  });

  it("adds the creator as a member and enforces the composite pk against duplicates", async () => {
    const userId = await seedUser();
    const group = await seedGroup(userId);

    await getTestDb()
      .insert(groupMembers)
      .values({ groupId: group.id, userId, role: "owner" });

    await expect(
      getTestDb().insert(groupMembers).values({ groupId: group.id, userId, role: "member" }),
    ).rejects.toThrow();
  });

  it("retires a member with removed_at instead of deleting the row", async () => {
    const db = getTestDb();
    const userId = await seedUser();
    const group = await seedGroup(userId);
    await db.insert(groupMembers).values({ groupId: group.id, userId, role: "owner" });

    await db
      .update(groupMembers)
      .set({ removedAt: new Date() })
      .where(eq(groupMembers.userId, userId));

    const [row] = await db.select().from(groupMembers).where(eq(groupMembers.userId, userId));
    expect(row?.removedAt).toBeInstanceOf(Date);
  });

  it("cascades group_members when the group is deleted", async () => {
    const db = getTestDb();
    const userId = await seedUser();
    const group = await seedGroup(userId);
    await db.insert(groupMembers).values({ groupId: group.id, userId, role: "owner" });

    await db.delete(groups).where(eq(groups.id, group.id));

    const rows = await db.select().from(groupMembers).where(eq(groupMembers.groupId, group.id));
    expect(rows).toHaveLength(0);
  });

  it("stores a group invite code once the group it points to exists", async () => {
    const db = getTestDb();
    const userId = await seedUser();
    const group = await seedGroup(userId);

    const [invite] = await db
      .insert(inviteCodes)
      .values({ code: "group-invite-schema-test", groupId: group.id, createdBy: userId })
      .returning();

    expect(invite?.groupId).toBe(group.id);
  });
});

describe.skipIf(!hasTestDatabase)("auth_tokens / users recovery columns schema", () => {
  setupTestDb();

  async function seedUser() {
    const [user] = await getTestDb()
      .insert(users)
      .values({
        email: `${crypto.randomUUID()}@example.com`,
        displayName: "Ana",
        passwordHash: "x",
      })
      .returning();
    return user!;
  }

  it("defaults a new user to unverified with a whole-second session epoch", async () => {
    const user = await seedUser();

    expect(user.emailVerifiedAt).toBeNull();
    // date_trunc('second', now()) — T123's `iat >= sessions_valid_from`
    // check must be a plain comparison, so there can be no sub-second part.
    expect(user.sessionsValidFrom).toBeInstanceOf(Date);
    expect(user.sessionsValidFrom.getMilliseconds()).toBe(0);
    expect(user.sessionsValidFrom.getTime() % 1000).toBe(0);
  });

  it("stores a token per purpose and reads the purpose back", async () => {
    const db = getTestDb();
    const user = await seedUser();

    await db.insert(authTokens).values([
      {
        tokenHash: "sha256-reset",
        userId: user.id,
        purpose: "password_reset",
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
      {
        tokenHash: "sha256-verify",
        userId: user.id,
        purpose: "email_verify",
        expiresAt: new Date(Date.now() + 24 * 3_600_000),
      },
    ]);

    const rows = await db
      .select()
      .from(authTokens)
      .where(eq(authTokens.userId, user.id))
      .orderBy(authTokens.tokenHash);

    expect(new Set(rows.map((r) => r.purpose))).toEqual(new Set(["password_reset", "email_verify"]));
    expect(rows.every((r) => r.usedAt === null)).toBe(true);
  });

  it("rejects a duplicate token_hash", async () => {
    const db = getTestDb();
    const user = await seedUser();
    const row = {
      tokenHash: "sha256-dup",
      userId: user.id,
      purpose: "password_reset" as const,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    };

    await db.insert(authTokens).values(row);

    await expect(db.insert(authTokens).values(row)).rejects.toThrow();
  });

  it("rejects an unknown purpose at the database, not just in TypeScript", async () => {
    const db = getTestDb();
    const user = await seedUser();

    await expect(
      db.execute(sql`
        INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at)
        VALUES ('sha256-bad', ${user.id}, 'account_delete', now() + interval '1 hour')
      `),
    ).rejects.toThrow();
  });

  it("cascade-deletes a user's tokens when the user row goes", async () => {
    const db = getTestDb();
    const user = await seedUser();
    await db.insert(authTokens).values({
      tokenHash: "sha256-cascade",
      userId: user.id,
      purpose: "email_verify",
      expiresAt: new Date(Date.now() + 24 * 3_600_000),
    });

    await db.delete(users).where(eq(users.id, user.id));

    const rows = await db.select().from(authTokens).where(eq(authTokens.userId, user.id));
    expect(rows).toHaveLength(0);
  });
});
