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

  async function seedGroup(roles: ("owner" | "member")[]) {
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
    for (let i = 0; i < memberIds.length; i++) {
      await db.insert(groupMembers).values({ groupId: group!.id, userId: memberIds[i]!, role: roles[i]! });
    }
    return { groupId: group!.id, memberIds };
  }

  it("lists current members without email addresses", async () => {
    const { groupId, memberIds } = await seedGroup(["owner", "member"]);
    const members = await listMembers(groupId, memberIds[0]!);

    expect(members).toHaveLength(2);
    expect(members.map((m) => m.role).sort()).toEqual(["member", "owner"]);
    for (const member of members) expect(member).not.toHaveProperty("email");
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
