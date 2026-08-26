import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  customType,
  index,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Case-insensitive text. Drizzle has no built-in citext, so it's a
 * customType over the extension enabled inline in migration 0000.
 *
 * Comparison and uniqueness are case-insensitive at the database level,
 * which is the only way to actually prevent `Santiago@x.com` and
 * `santiago@x.com` from becoming two accounts — a UNIQUE constraint on
 * plain text won't.
 */
const citext = customType<{ data: string }>({
  dataType: () => "citext",
});

/** No role column — authorization here is membership-based (T021), not role-based. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: citext("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Reference data, seeded by migration (see 0002). The one authoritative home
 * for the ISO-4217 minor-unit exponent, so every money-bearing column can
 * carry a real FK instead of a hardcoded currency list.
 *
 * `exponent` and `displayDecimals` differ on purpose for COP: ISO gives it
 * two minor digits, but Colombians write pesos with none. See
 * ADR-0004 and docs/context/currency.md § Supported currencies.
 */
export const currencies = pgTable("currencies", {
  code: char("code", { length: 3 }).primaryKey(),
  exponent: smallint("exponent").notNull(),
  displayDecimals: smallint("display_decimals").notNull(),
  name: text("name").notNull(),
});

/**
 * A trip or shared activity. `displayCurrency = null` means "show every
 * expense in the currency it was entered in" — set, it's a reversible
 * display preference plus a pinned rate snapshot (ADR-0007), never a
 * rewrite of expense rows.
 *
 * `simplifyDebts` is the *only* thing debt simplification ever writes
 * anywhere (ADR-0006) — a plain boolean flip, nothing computed or cached.
 */
export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  defaultCurrency: char("default_currency", { length: 3 })
    .notNull()
    .references(() => currencies.code),
  displayCurrency: char("display_currency", { length: 3 }).references(() => currencies.code),
  simplifyDebts: boolean("simplify_debts").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * `role` decides only who can rename/archive the group and manage members —
 * everything else any member can do (data-model.md). No global role; this is
 * the one exception to membership-only authorization.
 */
export const groupMemberRole = pgEnum("group_member_role", ["owner", "member"]);

/**
 * Composite pk `(group_id, user_id)`. Members are **never hard-deleted** —
 * `removedAt` retires them, because historical expenses reference this row
 * and it must survive.
 *
 * The explicit UNIQUE below duplicates the pk's own uniqueness — required by
 * T020's own acceptance criteria, ahead of T033's expense_payers/expense_splits
 * referencing this pair as a composite FK, so there's a named constraint to
 * point at explicitly rather than relying on whichever one Postgres resolves
 * the reference to.
 */
export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: groupMemberRole("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    unique("group_members_group_id_user_id_unique").on(table.groupId, table.userId),
    // "My groups": the app's most frequent query, and only ever over
    // current (non-removed) memberships.
    index("group_members_user_id_active_idx")
      .on(table.userId)
      .where(sql`${table.removedAt} IS NULL`),
  ],
);

/**
 * Single-use codes serving two purposes at once (ADR-0002): `group_id =
 * null` is a plain registration invite; `group_id` set is a group invite
 * that also registers you. Consumption is atomic with the user insert and,
 * when present, the membership insert (services/auth.ts `register`).
 *
 * `created_by` is nullable because `npm run seed:invite` mints the very
 * first code before any user exists.
 */
export const inviteCodes = pgTable(
  "invite_codes",
  {
    code: text("code").primaryKey(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    consumedBy: uuid("consumed_by").references(() => users.id, { onDelete: "set null" }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The lookup every consumption attempt makes: is this code still live?
    index("invite_codes_unconsumed_idx")
      .on(table.consumedAt)
      .where(sql`${table.consumedAt} IS NULL`),
  ],
);

/**
 * Token-bucket rate limiting, in Postgres rather than Redis — the volume
 * doesn't justify another container. `key` is opaque and namespaced by the
 * caller, e.g. `login:203.0.113.7`. `tokens` is numeric (not an integer) so
 * refill is continuous. See src/server/rate-limit/ for the consuming logic.
 */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  tokens: numeric("tokens").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
