import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { groupMembers, groups, users } from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("members service", () => {
  setupTestDb();

  let listMembers: typeof import("./members").listMembers;
  let removeMember: typeof import("./members").removeMember;
  let NotAGroupMemberError: typeof import("./members").NotAGroupMemberError;
  let LastOwnerCannotBeRemovedError: typeof import("./members").LastOwnerCannotBeRemovedError;
  let MemberHasOutstandingBalanceError: typeof import("./members").MemberHasOutstandingBalanceError;
  let createExpense: typeof import("./expenses").createExpense;
  let getGroupDetail: typeof import("./groups").getGroupDetail;
  let NotAMemberError: typeof import("../auth/membership").NotAMemberError;
  let NotGroupOwnerError: typeof import("../auth/membership").NotGroupOwnerError;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ listMembers, removeMember, NotAGroupMemberError, LastOwnerCannotBeRemovedError, MemberHasOutstandingBalanceError } =
      await import("./members"));
    ({ createExpense } = await import("./expenses"));
    ({ getGroupDetail } = await import("./groups"));
    ({ NotAMemberError, NotGroupOwnerError } = await import("../auth/membership"));
  });

  afterAll(() => vi.unstubAllEnvs());

  async function seedUsersAndGroup(roles: ("owner" | "member")[]) {
    const db = getTestDb();
    const memberIds: string[] = [];
    for (let i = 0; i < roles.length; i++) {
      const [user] = await db
        .insert(users)
        .values({ email: `${crypto.randomUUID()}@example.com`, displayName: `M${i}`, passwordHash: "x" })
        .returning();
      memberIds.push(user!.id);
    }
    const [group] = await db
      .insert(groups)
      .values({ title: "Trip", defaultCurrency: "COP", createdBy: memberIds[0] })
      .returning();
    return { db, groupId: group!.id, memberIds };
  }

  async function seedGroup(roles: ("owner" | "member")[]) {
    const { db, groupId, memberIds } = await seedUsersAndGroup(roles);
    for (let i = 0; i < memberIds.length; i++) {
      await db.insert(groupMembers).values({ groupId, userId: memberIds[i]!, role: roles[i]! });
    }
    return { groupId, memberIds };
  }

  /** One insert statement => one transaction timestamp => identical joined_at. */
  async function seedGroupSameJoinTime(roles: ("owner" | "member")[]) {
    const { db, groupId, memberIds } = await seedUsersAndGroup(roles);
    await db
      .insert(groupMembers)
      .values(memberIds.map((userId, i) => ({ groupId, userId, role: roles[i]! })));
    return { groupId, memberIds };
  }

  it("lists current members without email addresses", async () => {
    const { groupId, memberIds } = await seedGroup(["owner", "member"]);
    const members = await listMembers(groupId, memberIds[0]!);

    expect(members).toHaveLength(2);
    expect(members.map((m) => m.role).sort()).toEqual(["member", "owner"]);
    for (const member of members) expect(member).not.toHaveProperty("email");
  });

  it("orders members by join time — oldest first — not insertion or heap order", async () => {
    const db = getTestDb();
    const ids: string[] = [];
    for (const name of ["Cee", "Ay", "Bee"]) {
      const [user] = await db
        .insert(users)
        .values({ email: `${crypto.randomUUID()}@example.com`, displayName: name, passwordHash: "x" })
        .returning();
      ids.push(user!.id);
    }
    const [group] = await db
      .insert(groups)
      .values({ title: "Trip", defaultCurrency: "COP", createdBy: ids[0] })
      .returning();
    // Insert in one order; set joined_at in a deliberately different one so
    // this fails if the read falls back to insertion/heap order.
    await db.insert(groupMembers).values([
      { groupId: group!.id, userId: ids[0]!, role: "owner", joinedAt: new Date("2026-03-01T00:00:00Z") },
      { groupId: group!.id, userId: ids[1]!, role: "member", joinedAt: new Date("2026-01-01T00:00:00Z") },
      { groupId: group!.id, userId: ids[2]!, role: "member", joinedAt: new Date("2026-02-01T00:00:00Z") },
    ]);

    const byJoinTime = [ids[1], ids[2], ids[0]];
    expect((await listMembers(group!.id, ids[0]!)).map((m) => m.userId)).toEqual(byJoinTime);
    expect((await getGroupDetail(group!.id, ids[0]!)).members.map((m) => m.userId)).toEqual(byJoinTime);
  });

  it("breaks join-time ties on user_id, stably across calls", async () => {
    // A single insert => one transaction timestamp => identical joined_at,
    // so the user_id tiebreak is the only thing keeping this deterministic.
    const { groupId, memberIds } = await seedGroupSameJoinTime(["owner", "member", "member"]);

    const first = (await listMembers(groupId, memberIds[0]!)).map((m) => m.userId);
    const second = (await listMembers(groupId, memberIds[0]!)).map((m) => m.userId);
    expect(first).toEqual(second);
    expect(first).toEqual([...memberIds].sort());
    expect((await getGroupDetail(groupId, memberIds[0]!)).members.map((m) => m.userId)).toEqual(first);
  });

  it("removes a member with a zero balance", async () => {
    const { groupId, memberIds } = await seedGroup(["owner", "member"]);
    await removeMember(groupId, memberIds[0]!, memberIds[1]!);

    const members = await listMembers(groupId, memberIds[0]!);
    expect(members.map((m) => m.userId)).toEqual([memberIds[0]]);
  });

  it("refuses removal while the member has a non-zero balance in a second currency", async () => {
    const { groupId, memberIds } = await seedGroup(["owner", "member"]);
    // Settle COP exactly, but leave a USD debt outstanding.
    await createExpense(groupId, memberIds[0]!, {
      title: "COP thing",
      date: "2026-08-24",
      amount: "2000",
      currency: "COP",
      paidBy: [{ userId: memberIds[1]!, amount: "2000" }],
      split: { strategy: "equal_subset", members: [memberIds[1]!] },
    });
    await createExpense(groupId, memberIds[0]!, {
      title: "USD thing",
      date: "2026-08-24",
      amount: "200",
      currency: "USD",
      split: { strategy: "equal" },
    });

    const error = await removeMember(groupId, memberIds[0]!, memberIds[1]!).catch((e) => e);
    expect(error).toBeInstanceOf(MemberHasOutstandingBalanceError);
    expect(error.details.balances).toEqual([{ currency: "USD", net: "-100" }]);
  });

  it("removes a member with zero balance in a currency they were never even active in", async () => {
    const { groupId, memberIds } = await seedGroup(["owner", "member"]);
    // Only memberIds[0] ever touches USD — memberIds[1] has no row there at
    // all, not even a zero one, which is a different code path than a
    // currency they're square in.
    await createExpense(groupId, memberIds[0]!, {
      title: "USD thing",
      date: "2026-08-24",
      amount: "200",
      currency: "USD",
      split: { strategy: "equal_subset", members: [memberIds[0]!] },
    });

    await removeMember(groupId, memberIds[0]!, memberIds[1]!);
    const members = await listMembers(groupId, memberIds[0]!);
    expect(members.map((m) => m.userId)).toEqual([memberIds[0]]);
  });

  it("404s removing a target who isn't a current member", async () => {
    const { groupId, memberIds } = await seedGroup(["owner"]);
    await expect(removeMember(groupId, memberIds[0]!, crypto.randomUUID())).rejects.toThrow(
      NotAGroupMemberError,
    );
  });

  it("403s a non-owner trying to remove someone", async () => {
    const { groupId, memberIds } = await seedGroup(["owner", "member"]);
    await expect(removeMember(groupId, memberIds[1]!, memberIds[0]!)).rejects.toThrow(NotGroupOwnerError);
  });

  it("refuses the only owner removing themselves", async () => {
    const { groupId, memberIds } = await seedGroup(["owner"]);
    await expect(removeMember(groupId, memberIds[0]!, memberIds[0]!)).rejects.toThrow(
      LastOwnerCannotBeRemovedError,
    );
  });

  it("allows an owner to remove themselves when a co-owner remains", async () => {
    const { groupId, memberIds } = await seedGroup(["owner", "owner"]);
    await removeMember(groupId, memberIds[0]!, memberIds[0]!);

    const members = await listMembers(groupId, memberIds[1]!);
    expect(members.map((m) => m.userId)).toEqual([memberIds[1]]);
  });

  it("a removed member loses access immediately", async () => {
    const { groupId, memberIds } = await seedGroup(["owner", "member"]);
    await removeMember(groupId, memberIds[0]!, memberIds[1]!);

    await expect(getGroupDetail(groupId, memberIds[1]!)).rejects.toThrow(NotAMemberError);
    await expect(listMembers(groupId, memberIds[1]!)).rejects.toThrow(NotAMemberError);
  });

  it("still allows removing an owner-mate, leaving the group with one owner", async () => {
    const { groupId, memberIds } = await seedGroup(["owner", "owner"]);
    await removeMember(groupId, memberIds[0]!, memberIds[1]!);

    const [remaining] = await getTestDb()
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.userId, memberIds[1]!));
    expect(remaining?.removedAt).not.toBeNull();
  });
});
