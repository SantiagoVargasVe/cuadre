import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { groupMembers, groups, users } from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("membership guards", () => {
  setupTestDb();

  let assertGroupNotArchived: typeof import("./membership").assertGroupNotArchived;
  let GroupArchivedError: typeof import("./membership").GroupArchivedError;
  let NotAMemberError: typeof import("./membership").NotAMemberError;
  let NotGroupOwnerError: typeof import("./membership").NotGroupOwnerError;
  let requireMembership: typeof import("./membership").requireMembership;
  let requireMembershipForRow: typeof import("./membership").requireMembershipForRow;
  let requireOwner: typeof import("./membership").requireOwner;

  beforeAll(async () => {
    // membership.ts imports the pooled `db` singleton (db/client.ts), which
    // validates the full app config at import time — unlike getTestDb()
    // above, which opens its own connection straight to DATABASE_URL_TEST.
    // Same stubbing as services/auth.test.ts for the same reason.
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({
      assertGroupNotArchived,
      GroupArchivedError,
      NotAMemberError,
      NotGroupOwnerError,
      requireMembership,
      requireMembershipForRow,
      requireOwner,
    } = await import("./membership"));
  });

  afterAll(() => vi.unstubAllEnvs());

  async function seedUser() {
    const [user] = await getTestDb()
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Ana", passwordHash: "x" })
      .returning();
    return user!.id;
  }

  async function seedGroup(createdBy: string, extra: Record<string, unknown> = {}) {
    const [group] = await getTestDb()
      .insert(groups)
      .values({ title: "Cartagena 2026", defaultCurrency: "COP", createdBy, ...extra })
      .returning();
    return group!;
  }

  async function addMember(groupId: string, userId: string, extra: Record<string, unknown> = {}) {
    await getTestDb().insert(groupMembers).values({ groupId, userId, ...extra });
  }

  describe("requireMembership", () => {
    it("throws NotAMemberError for someone never added to the group", async () => {
      const owner = await seedUser();
      const group = await seedGroup(owner);
      const outsider = await seedUser();

      await expect(requireMembership(group.id, outsider)).rejects.toThrow(NotAMemberError);
    });

    it("throws NotAMemberError for a removed member", async () => {
      const owner = await seedUser();
      const group = await seedGroup(owner);
      const removed = await seedUser();
      await addMember(group.id, removed, { removedAt: new Date() });

      await expect(requireMembership(group.id, removed)).rejects.toThrow(NotAMemberError);
    });

    it("returns the membership row for a current member", async () => {
      const owner = await seedUser();
      const group = await seedGroup(owner);
      await addMember(group.id, owner, { role: "owner" });

      const membership = await requireMembership(group.id, owner);

      expect(membership.userId).toBe(owner);
      expect(membership.role).toBe("owner");
    });

    it("is a 404, never a 403, for a group id that doesn't exist at all", async () => {
      const someone = await seedUser();

      const error = await requireMembership(crypto.randomUUID(), someone).catch(
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(NotAMemberError);
      expect((error as InstanceType<typeof NotAMemberError>).status).toBe(404);
    });
  });

  describe("requireOwner", () => {
    it("throws NotAMemberError for a non-member", async () => {
      const owner = await seedUser();
      const group = await seedGroup(owner);
      const outsider = await seedUser();

      await expect(requireOwner(group.id, outsider)).rejects.toThrow(NotAMemberError);
    });

    it("throws NotGroupOwnerError (403) for a member who isn't owner", async () => {
      const owner = await seedUser();
      const group = await seedGroup(owner);
      const member = await seedUser();
      await addMember(group.id, member, { role: "member" });

      const error = await requireOwner(group.id, member).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotGroupOwnerError);
      expect((error as InstanceType<typeof NotGroupOwnerError>).status).toBe(403);
    });

    it("passes for the owner", async () => {
      const owner = await seedUser();
      const group = await seedGroup(owner);
      await addMember(group.id, owner, { role: "owner" });

      await expect(requireOwner(group.id, owner)).resolves.toMatchObject({ role: "owner" });
    });
  });

  it("keeps an archived group readable via requireMembership, rejecting only assertGroupNotArchived", async () => {
    const owner = await seedUser();
    const group = await seedGroup(owner, { archivedAt: new Date() });
    await addMember(group.id, owner, { role: "owner" });

    const membership = await requireMembership(group.id, owner);

    expect(membership.role).toBe("owner");
    expect(() => assertGroupNotArchived(group)).toThrow(GroupArchivedError);
  });

  describe("assertGroupNotArchived", () => {
    it("passes for an active group", () => {
      expect(() => assertGroupNotArchived({ archivedAt: null })).not.toThrow();
    });

    it("throws GroupArchivedError (422) for an archived group", () => {
      const error = (() => {
        try {
          assertGroupNotArchived({ archivedAt: new Date() });
          return undefined;
        } catch (caught) {
          return caught;
        }
      })();

      expect(error).toBeInstanceOf(GroupArchivedError);
      expect((error as InstanceType<typeof GroupArchivedError>).status).toBe(422);
    });
  });

  describe("requireMembershipForRow", () => {
    it("throws NotAMemberError when the row doesn't exist", async () => {
      const someone = await seedUser();

      await expect(requireMembershipForRow(undefined, someone)).rejects.toThrow(NotAMemberError);
    });

    it("throws NotAMemberError when the row's group has no such member", async () => {
      const owner = await seedUser();
      const group = await seedGroup(owner);
      const outsider = await seedUser();

      await expect(
        requireMembershipForRow({ groupId: group.id, id: "expense-1" }, outsider),
      ).rejects.toThrow(NotAMemberError);
    });

    it("returns the row and membership when the acting user belongs to the row's group", async () => {
      const owner = await seedUser();
      const group = await seedGroup(owner);
      await addMember(group.id, owner, { role: "owner" });
      const row = { groupId: group.id, id: "expense-1" };

      const result = await requireMembershipForRow(row, owner);

      expect(result.row).toBe(row);
      expect(result.membership.userId).toBe(owner);
    });
  });
});
