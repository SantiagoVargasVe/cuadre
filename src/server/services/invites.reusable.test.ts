import { and, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../test/db";
import { groupMembers, groups, inviteCodes, legalAcceptances, users } from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const NOW = new Date("2030-01-10T12:00:00.000Z");

describe.skipIf(!hasTestDatabase)("reusable group invites", () => {
  setupTestDb();
  let invites: typeof import("./invites");
  let auth: typeof import("./auth");
  let createGroup: typeof import("./groups").createGroup;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR,GTQ");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "false");
    invites = await import("./invites");
    auth = await import("./auth");
    ({ createGroup } = await import("./groups"));
  });
  afterAll(() => vi.unstubAllEnvs());
  afterEach(() => vi.useRealTimers());

  async function user(displayName = "Ana") {
    const [row] = await getTestDb().insert(users).values({
      email: `${crypto.randomUUID()}@example.com`, displayName, passwordHash: "x",
    }).returning();
    return row!.id;
  }

  async function trip() {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const owner = await user();
    const group = await createGroup(owner, { title: "Guatemala" });
    const invite = await invites.createInvite(group.id, owner);
    return { owner, group, ...invite };
  }

  function register(code: string, email = `${crypto.randomUUID()}@example.com`) {
    return auth.register({ email, displayName: "Amigo", password: "correct horse battery staple",
      inviteCode: code, termsAccepted: true, privacyAccepted: true });
  }

  async function stored(code: string) {
    const [row] = await getTestDb().select().from(inviteCodes).where(eq(inviteCodes.code, code));
    return row!;
  }

  it("one shared link registers two new friends and admits an existing user without extending expiry", async () => {
    const { owner, group, code, url, expiresAt } = await trip();
    expect(url).toBe(`http://localhost:3000/join/${code}`);
    expect(expiresAt).toBe("2030-01-11T12:00:00.000Z");
    const existing = await user("Beto");
    await invites.acceptInvite(code, existing);
    const caro = await register(code);
    const dani = await register(code);
    const members = await getTestDb().select().from(groupMembers).where(eq(groupMembers.groupId, group.id));
    expect(members.map(({ userId }) => userId).sort()).toEqual([owner, existing, caro.user.id, dani.user.id].sort());
    expect(await getTestDb().select().from(legalAcceptances)).toHaveLength(4);
    expect(await stored(code)).toMatchObject({ reusable: true, consumedAt: null, consumedBy: null,
      createdAt: NOW, expiresAt: new Date(expiresAt) });
    expect(await invites.lookupInvite(code)).toEqual({ valid: true, groupTitle: "Guatemala", inviterName: "Ana", expiresAt });
  });

  it("admits concurrent existing users and new-account registrations", async () => {
    const { group, code } = await trip();
    const existing = await Promise.all([user(), user()]);
    await Promise.all([invites.acceptInvite(code, existing[0]!), invites.acceptInvite(code, existing[1]!),
      register(code), register(code)]);
    expect(await getTestDb().select().from(groupMembers).where(eq(groupMembers.groupId, group.id))).toHaveLength(5);
    expect((await stored(code)).consumedAt).toBeNull();
  });

  it("concurrent duplicate acceptance cannot duplicate membership, downgrade an owner or burn the link", async () => {
    const { owner, group, code } = await trip();
    await expect(invites.acceptInvite(code, owner)).rejects.toThrow(invites.AlreadyAMemberError);
    const friend = await user();
    const results = await Promise.allSettled([invites.acceptInvite(code, friend), invites.acceptInvite(code, friend)]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: expect.any(invites.AlreadyAMemberError) });
    const members = await getTestDb().select().from(groupMembers).where(eq(groupMembers.groupId, group.id));
    expect(members).toHaveLength(2);
    expect(members.find(({ userId }) => userId === owner)?.role).toBe("owner");
    await invites.acceptInvite(code, await user());
  });

  it("reactivates removed members as plain members", async () => {
    const { group, code } = await trip();
    const friend = await user();
    await getTestDb().insert(groupMembers).values({ groupId: group.id, userId: friend,
      role: "owner", removedAt: NOW });
    await invites.acceptInvite(code, friend);
    const [member] = await getTestDb().select().from(groupMembers).where(eq(groupMembers.userId, friend));
    expect(member).toMatchObject({ role: "member", removedAt: null });
  });

  it.each([-1, 0, 1])("enforces lookup and acceptance at expiry offset %i ms", async (offset) => {
    const { code, expiresAt } = await trip();
    const friend = await user();
    vi.setSystemTime(Date.parse(expiresAt) + offset);
    expect((await invites.lookupInvite(code)).valid).toBe(offset < 0);
    if (offset < 0) await invites.acceptInvite(code, friend);
    else await expect(invites.acceptInvite(code, friend)).rejects.toThrow(invites.InvalidInviteError);
  });

  it("rejects registration at the exact deadline and rolls back the account and legal rows", async () => {
    const { code, expiresAt } = await trip();
    vi.setSystemTime(new Date(expiresAt));
    await expect(register(code)).rejects.toThrow(invites.InvalidInviteError);
    expect(await getTestDb().select().from(users)).toHaveLength(1);
    expect(await getTestDb().select().from(legalAcceptances)).toHaveLength(0);
    expect(await getTestDb().select().from(groupMembers)).toHaveLength(1);
  });

  it("rejects lookup, joining, registration and minting for an archived group", async () => {
    const { owner, group, code } = await trip();
    const friend = await user();
    await getTestDb().update(groups).set({ archivedAt: NOW }).where(eq(groups.id, group.id));
    expect(await invites.lookupInvite(code)).toEqual({ valid: false });
    await expect(invites.acceptInvite(code, friend)).rejects.toThrow(invites.InvalidInviteError);
    await expect(register(code)).rejects.toThrow(invites.InvalidInviteError);
    await expect(invites.createInvite(group.id, owner)).rejects.toMatchObject({ code: "GROUP_ARCHIVED" });
    expect(await getTestDb().select().from(users)).toHaveLength(2);
    expect(await getTestDb().select().from(groupMembers)).toHaveLength(1);
  });

  it("preserves legacy group links as single-use and never revives expired or consumed codes", async () => {
    const { group } = await trip();
    const friend = await user();
    await getTestDb().insert(inviteCodes).values([
      { code: "legacy-live", groupId: group.id },
      { code: "legacy-used", groupId: group.id, consumedAt: NOW, consumedBy: friend },
      { code: "legacy-expired", groupId: group.id, expiresAt: NOW },
    ]);
    expect((await stored("legacy-live")).reusable).toBe(false);
    await invites.acceptInvite("legacy-live", friend);
    for (const code of ["legacy-live", "legacy-used", "legacy-expired"]) {
      expect(await invites.lookupInvite(code)).toEqual({ valid: false });
      await expect(register(code)).rejects.toThrow(invites.InvalidInviteError);
    }
  });

  it("rolls back registration when membership creation fails and leaves the shared link usable", async () => {
    const { code } = await trip();
    const db = getTestDb();
    await db.execute(sql`CREATE FUNCTION reject_t134_join() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'forced membership failure'; END; $$`);
    await db.execute(sql`CREATE TRIGGER reject_t134_join BEFORE INSERT ON group_members
      FOR EACH ROW EXECUTE FUNCTION reject_t134_join()`);
    try {
      await expect(register(code)).rejects.toThrow();
    } finally {
      await db.execute(sql`DROP TRIGGER reject_t134_join ON group_members`);
      await db.execute(sql`DROP FUNCTION reject_t134_join()`);
    }
    expect(await db.select().from(users)).toHaveLength(1);
    expect(await db.select().from(legalAcceptances)).toHaveLength(0);
    expect((await stored(code)).consumedAt).toBeNull();
    await register(code);
  });

  it("rejects reusable rows without a group, expiry or with a consumed state", async () => {
    const { owner, group } = await trip();
    await expect(getTestDb().insert(inviteCodes).values({ code: "no-group", reusable: true, expiresAt: NOW })).rejects.toThrow();
    await expect(getTestDb().insert(inviteCodes).values({ code: "no-expiry", reusable: true, groupId: group.id })).rejects.toThrow();
    await expect(getTestDb().insert(inviteCodes).values({ code: "spent", reusable: true, groupId: group.id,
      expiresAt: NOW, consumedAt: NOW, consumedBy: owner })).rejects.toThrow();
  });

  it("does not let a removed member mint a link", async () => {
    const { owner, group } = await trip();
    await getTestDb().update(groupMembers).set({ removedAt: NOW })
      .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, owner)));
    await expect(invites.createInvite(group.id, owner)).rejects.toMatchObject({ code: "NOT_A_MEMBER" });
  });

  it("refuses a join whose wait for the invite lock crosses the deadline", async () => {
    const { code, expiresAt } = await trip();
    const friend = await user();
    let unlock!: () => void;
    let signalLocked!: () => void;
    const released = new Promise<void>((resolve) => { unlock = resolve; });
    const locked = new Promise<void>((resolve) => { signalLocked = resolve; });
    const { withTransaction } = await import("../db/client");
    const holding = withTransaction(async (tx) => {
      await tx.select().from(inviteCodes).where(eq(inviteCodes.code, code)).for("update");
      signalLocked();
      await released;
    });
    await locked;
    const joining = invites.acceptInvite(code, friend).catch((error: unknown) => error);
    try {
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const rows = await getTestDb().execute(sql`SELECT 1 FROM pg_stat_activity
          WHERE wait_event_type = 'Lock' AND query LIKE 'update "invite_codes"%'`);
        if (rows.length > 0) { waiting = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
      vi.setSystemTime(new Date(expiresAt));
    } finally {
      unlock();
      await holding;
    }
    expect(await joining).toBeInstanceOf(invites.InvalidInviteError);
    expect(await getTestDb().select().from(groupMembers).where(eq(groupMembers.userId, friend))).toHaveLength(0);
  });
});
