import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { groupMembers, groups, inviteCodes, users } from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("invites service", () => {
  setupTestDb();

  let consumeInvite: typeof import("./invites").consumeInvite;
  let InvalidInviteError: typeof import("./invites").InvalidInviteError;
  let createInvite: typeof import("./invites").createInvite;
  let lookupInvite: typeof import("./invites").lookupInvite;
  let acceptInvite: typeof import("./invites").acceptInvite;
  let NotAGroupInviteError: typeof import("./invites").NotAGroupInviteError;
  let AlreadyAMemberError: typeof import("./invites").AlreadyAMemberError;
  let NotAMemberError: typeof import("../auth/membership").NotAMemberError;

  beforeAll(async () => {
    // invites.ts imports the pooled `db` singleton (needed by
    // createInvite/lookupInvite/acceptInvite), which validates the full
    // app config at import time — so this has to be a dynamic import
    // after stubbing, same as services/auth.test.ts and groups.test.ts.
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ consumeInvite, InvalidInviteError, createInvite, lookupInvite, acceptInvite, NotAGroupInviteError, AlreadyAMemberError } =
      await import("./invites"));
    ({ NotAMemberError } = await import("../auth/membership"));
  });

  afterAll(() => vi.unstubAllEnvs());

  async function seedUser(displayName = "Ana") {
    const [user] = await getTestDb()
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName, passwordHash: "x" })
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

  describe("consumeInvite", () => {
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
      const group = await seedGroup(userId);
      await db.insert(inviteCodes).values({ code: "group-invite-1", groupId: group.id });

      const result = await db.transaction((tx) => consumeInvite(tx, "group-invite-1", userId));

      expect(result).toEqual({ groupId: group.id });
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

  describe("createInvite", () => {
    it("throws NotAMemberError for a non-member", async () => {
      const owner = await seedUser();
      const group = await seedGroup(owner);
      const outsider = await seedUser();

      await expect(createInvite(group.id, outsider, {})).rejects.toThrow(NotAMemberError);
    });

    it("mints a code and a url built from APP_URL", async () => {
      const owner = await seedUser();
      const group = await seedGroup(owner);
      await getTestDb().insert(groupMembers).values({ groupId: group.id, userId: owner, role: "owner" });

      const { code, url } = await createInvite(group.id, owner, {});

      expect(code).toHaveLength(16);
      expect(url).toBe(`http://localhost:3000/join/${code}`);
    });
  });

  describe("lookupInvite", () => {
    it("returns valid:false for a code that doesn't exist", async () => {
      await expect(lookupInvite("no-such-code")).resolves.toEqual({ valid: false });
    });

    it("returns valid:false for an already-consumed code, indistinguishably from unknown", async () => {
      const userId = await seedUser();
      await getTestDb()
        .insert(inviteCodes)
        .values({ code: "consumed-lookup", createdBy: userId, consumedAt: new Date(), consumedBy: userId });

      await expect(lookupInvite("consumed-lookup")).resolves.toEqual({ valid: false });
    });

    it("returns valid:false for an expired code", async () => {
      await getTestDb()
        .insert(inviteCodes)
        .values({ code: "expired-lookup", expiresAt: new Date(Date.now() - 60_000) });

      await expect(lookupInvite("expired-lookup")).resolves.toEqual({ valid: false });
    });

    it("returns only groupTitle, inviterName, and valid for a live group invite", async () => {
      const owner = await seedUser("Ana");
      const group = await seedGroup(owner);
      await getTestDb().insert(inviteCodes).values({ code: "live-lookup", groupId: group.id, createdBy: owner });

      const result = await lookupInvite("live-lookup");

      expect(result).toEqual({ valid: true, groupTitle: "Cartagena 2026", inviterName: "Ana" });
      expect(JSON.stringify(result)).not.toContain("@");
    });

    it("omits groupTitle for a plain registration invite", async () => {
      const userId = await seedUser("Ana");
      await getTestDb().insert(inviteCodes).values({ code: "plain-lookup", createdBy: userId });

      const result = await lookupInvite("plain-lookup");
      expect(result).toEqual({ valid: true, groupTitle: undefined, inviterName: "Ana" });
    });
  });

  describe("acceptInvite", () => {
    it("adds the membership and returns the group", async () => {
      const owner = await seedUser();
      const group = await seedGroup(owner);
      const invitee = await seedUser("Beto");
      await getTestDb().insert(inviteCodes).values({ code: "accept-1", groupId: group.id, createdBy: owner });

      const result = await acceptInvite("accept-1", invitee);

      expect(result.id).toBe(group.id);
      const [membership] = await getTestDb()
        .select()
        .from(groupMembers)
        .where(eq(groupMembers.userId, invitee));
      expect(membership?.groupId).toBe(group.id);
      expect(membership?.role).toBe("member");
    });

    it("throws InvalidInviteError for a code that doesn't exist", async () => {
      const userId = await seedUser();
      await expect(acceptInvite("no-such-code", userId)).rejects.toThrow(InvalidInviteError);
    });

    it("throws NotAGroupInviteError for a plain registration invite", async () => {
      const creator = await seedUser();
      const invitee = await seedUser("Beto");
      await getTestDb().insert(inviteCodes).values({ code: "plain-accept", createdBy: creator });

      await expect(acceptInvite("plain-accept", invitee)).rejects.toThrow(NotAGroupInviteError);
    });

    it("throws AlreadyAMemberError and leaves the code unconsumed", async () => {
      const owner = await seedUser();
      const group = await seedGroup(owner);
      await getTestDb().insert(groupMembers).values({ groupId: group.id, userId: owner, role: "owner" });
      await getTestDb().insert(inviteCodes).values({ code: "already-member", groupId: group.id, createdBy: owner });

      await expect(acceptInvite("already-member", owner)).rejects.toThrow(AlreadyAMemberError);

      const [row] = await getTestDb().select().from(inviteCodes).where(eq(inviteCodes.code, "already-member"));
      expect(row?.consumedAt).toBeNull();
    });

    it("reactivates a removed member's row instead of rejecting the composite pk conflict", async () => {
      const owner = await seedUser();
      const group = await seedGroup(owner);
      const returning = await seedUser("Beto");
      await getTestDb().insert(groupMembers).values({
        groupId: group.id,
        userId: returning,
        role: "owner",
        removedAt: new Date("2020-01-01"),
      });
      await getTestDb()
        .insert(inviteCodes)
        .values({ code: "rejoin", groupId: group.id, createdBy: owner });

      await acceptInvite("rejoin", returning);

      const [membership] = await getTestDb()
        .select()
        .from(groupMembers)
        .where(eq(groupMembers.userId, returning));
      expect(membership?.removedAt).toBeNull();
      // Back to a plain member, not silently restored as owner.
      expect(membership?.role).toBe("member");
      expect(membership?.joinedAt.getFullYear()).toBeGreaterThan(2020);
    });
  });
});
