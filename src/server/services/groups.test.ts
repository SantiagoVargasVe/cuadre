import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { groupMembers, users } from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("groups service", () => {
  setupTestDb();

  let createGroup: typeof import("./groups").createGroup;
  let getGroupDetail: typeof import("./groups").getGroupDetail;
  let updateGroup: typeof import("./groups").updateGroup;
  let archiveGroup: typeof import("./groups").archiveGroup;
  let listMyGroups: typeof import("./groups").listMyGroups;
  let createExpense: typeof import("./expenses").createExpense;
  let UnsupportedCurrencyError: typeof import("./currencies").UnsupportedCurrencyError;
  let GroupArchivedError: typeof import("../auth/membership").GroupArchivedError;
  let NotAMemberError: typeof import("../auth/membership").NotAMemberError;
  let NotGroupOwnerError: typeof import("../auth/membership").NotGroupOwnerError;

  beforeAll(async () => {
    // Both modules import the pooled `db` singleton (db/client.ts), which
    // validates the full app config at import time — so the dynamic
    // imports below have to happen after stubbing, not as static imports.
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ createGroup, getGroupDetail, updateGroup, archiveGroup, listMyGroups } = await import(
      "./groups"
    ));
    ({ createExpense } = await import("./expenses"));
    ({ UnsupportedCurrencyError } = await import("./currencies"));
    ({ GroupArchivedError, NotAMemberError, NotGroupOwnerError } = await import(
      "../auth/membership"
    ));
  });

  afterAll(() => vi.unstubAllEnvs());

  async function seedUser(displayName = "Ana") {
    const [user] = await getTestDb()
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName, passwordHash: "x" })
      .returning();
    return user!.id;
  }

  describe("createGroup", () => {
    it("makes the creator the sole owner member", async () => {
      const userId = await seedUser();

      const group = await createGroup(userId, { title: "Cartagena 2026" });

      const members = await getTestDb()
        .select()
        .from(groupMembers)
        .where(eq(groupMembers.groupId, group.id));
      expect(members).toHaveLength(1);
      expect(members[0]?.userId).toBe(userId);
      expect(members[0]?.role).toBe("owner");
    });

    it("defaults to DEFAULT_CURRENCY when none is given", async () => {
      const userId = await seedUser();
      const group = await createGroup(userId, { title: "Trip" });
      expect(group.defaultCurrency).toBe("COP");
    });

    it("rejects a currency outside SUPPORTED_CURRENCIES", async () => {
      const userId = await seedUser();
      await expect(
        createGroup(userId, { title: "Trip", defaultCurrency: "JPY" }),
      ).rejects.toThrow(UnsupportedCurrencyError);
    });
  });

  describe("getGroupDetail", () => {
    it("throws NotAMemberError for a non-member", async () => {
      const owner = await seedUser();
      const group = await createGroup(owner, { title: "Trip" });
      const outsider = await seedUser();

      await expect(getGroupDetail(group.id, outsider)).rejects.toThrow(NotAMemberError);
    });

    it("returns members by display name and id, never email", async () => {
      const owner = await seedUser("Ana");
      const group = await createGroup(owner, { title: "Trip" });

      const { members } = await getGroupDetail(group.id, owner);

      expect(members).toEqual([{ userId: owner, displayName: "Ana", role: "owner", avatar: null }]);
      expect(JSON.stringify(members)).not.toContain("@");
    });

    it("surfaces displayCurrency and simplifyDebts as their own settings object", async () => {
      const owner = await seedUser();
      const group = await createGroup(owner, { title: "Trip" });

      const { settings } = await getGroupDetail(group.id, owner);

      expect(settings).toEqual({ displayCurrency: null, simplifyDebts: false });
    });
  });

  describe("updateGroup", () => {
    it("throws NotAMemberError for a non-member", async () => {
      const owner = await seedUser();
      const group = await createGroup(owner, { title: "Trip" });
      const outsider = await seedUser();

      await expect(updateGroup(group.id, outsider, { title: "Nope" })).rejects.toThrow(
        NotAMemberError,
      );
    });

    it("lets a non-owner member rename the group", async () => {
      const owner = await seedUser();
      const group = await createGroup(owner, { title: "Trip" });
      const member = await seedUser("Beto");
      await getTestDb().insert(groupMembers).values({ groupId: group.id, userId: member });

      const updated = await updateGroup(group.id, member, { title: "Cartagena!" });
      expect(updated.title).toBe("Cartagena!");
    });

    it("flips simplifyDebts and nothing else", async () => {
      const owner = await seedUser();
      const group = await createGroup(owner, { title: "Trip" });

      const updated = await updateGroup(group.id, owner, { simplifyDebts: true });

      expect(updated.simplifyDebts).toBe(true);
      expect(updated.title).toBe("Trip");
      expect(updated.defaultCurrency).toBe(group.defaultCurrency);
    });

    it("rejects a write against an archived group", async () => {
      const owner = await seedUser();
      const group = await createGroup(owner, { title: "Trip" });
      await archiveGroup(group.id, owner);

      await expect(updateGroup(group.id, owner, { title: "Nope" })).rejects.toThrow(
        GroupArchivedError,
      );
    });
  });

  describe("archiveGroup", () => {
    it("throws NotAMemberError for a non-member", async () => {
      const owner = await seedUser();
      const group = await createGroup(owner, { title: "Trip" });
      const outsider = await seedUser();

      await expect(archiveGroup(group.id, outsider)).rejects.toThrow(NotAMemberError);
    });

    it("throws NotGroupOwnerError for a member who isn't owner", async () => {
      const owner = await seedUser();
      const group = await createGroup(owner, { title: "Trip" });
      const member = await seedUser("Beto");
      await getTestDb().insert(groupMembers).values({ groupId: group.id, userId: member });

      await expect(archiveGroup(group.id, member)).rejects.toThrow(NotGroupOwnerError);
    });

    it("sets archivedAt for the owner", async () => {
      const owner = await seedUser();
      const group = await createGroup(owner, { title: "Trip" });

      const archived = await archiveGroup(group.id, owner);
      expect(archived.archivedAt).toBeInstanceOf(Date);
    });

    it("is idempotent, keeping the original archivedAt on a second call", async () => {
      const owner = await seedUser();
      const group = await createGroup(owner, { title: "Trip" });

      const first = await archiveGroup(group.id, owner);
      const second = await archiveGroup(group.id, owner);

      expect(second.archivedAt).toEqual(first.archivedAt);
    });
  });

  describe("listMyGroups", () => {
    it("returns one entry per group, each with its own net per currency", async () => {
      const ana = await seedUser("Ana");
      const beto = await seedUser("Beto");
      const groupA = await createGroup(ana, { title: "Group A" });
      await getTestDb().insert(groupMembers).values({ groupId: groupA.id, userId: beto, role: "member" });
      await createExpense(groupA.id, ana, {
        title: "Dinner",
        date: "2026-08-24",
        amount: "9000",
        currency: "COP",
        split: { strategy: "equal" },
      });
      const groupB = await createGroup(ana, { title: "Group B" });

      const items = await listMyGroups(ana);

      expect(items).toHaveLength(2);
      const a = items.find((g) => g.id === groupA.id)!;
      expect(a.memberCount).toBe(2);
      expect(a.yourNet).toEqual([{ currency: "COP", net: "4500" }]);
      const b = items.find((g) => g.id === groupB.id)!;
      expect(b.memberCount).toBe(1);
      expect(b.yourNet).toEqual([]);
    });

    it("flags an archived group instead of dropping it", async () => {
      const ana = await seedUser();
      const group = await createGroup(ana, { title: "Old trip" });
      await archiveGroup(group.id, ana);

      const items = await listMyGroups(ana);
      expect(items).toEqual([expect.objectContaining({ id: group.id, archivedAt: expect.any(String) })]);
    });

    it("never includes a group the user isn't a current member of", async () => {
      const ana = await seedUser();
      const beto = await seedUser("Beto");
      await createGroup(beto, { title: "Not yours" });

      expect(await listMyGroups(ana)).toEqual([]);
    });

    it("gives independent, non-summed entries for a member with positions in three groups", async () => {
      const ana = await seedUser();
      for (let i = 0; i < 3; i++) await createGroup(ana, { title: `Trip ${i}` });

      expect(await listMyGroups(ana)).toHaveLength(3);
    });
  });
});
