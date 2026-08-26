import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  customType,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
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
 * Advisory only — the balance engine never reads this (ADR-0005). Stored
 * so the edit form reopens in the mode the expense was created in.
 */
export const splitStrategy = pgEnum("split_strategy", [
  "equal",
  "equal_subset",
  "shares",
  "percentage",
  "exact",
  "loan",
]);

/**
 * The ledger's parent row. **No `paid_by` column** (ADR-0005) — one payer
 * is the common case of N, expressed by `expense_payers` like every other
 * count. The balanced-expense constraint spanning this table plus its two
 * children is enforced by a deferred constraint trigger, not here — see
 * the hand-written SQL in this table's migration.
 */
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // Calendar date only — no time, no zone. A trip crossing timezones
    // must not shift "the dinner on the 14th" onto another day.
    expenseDate: date("expense_date", { mode: "string" }).notNull(),
    totalAmount: bigint("total_amount", { mode: "bigint" }).notNull(),
    currency: char("currency", { length: 3 })
      .notNull()
      .references(() => currencies.code),
    splitStrategy: splitStrategy("split_strategy").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    version: integer("version").notNull().default(1),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("expenses_total_amount_positive", sql`${table.totalAmount} > 0`),
    // The group feed's only query.
    index("expenses_group_id_expense_date_idx")
      .on(table.groupId, table.expenseDate.desc())
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

/**
 * `group_id` here is **denormalized on purpose** — it exists solely so
 * `FOREIGN KEY (group_id, user_id) REFERENCES group_members (group_id,
 * user_id)` can make "you cannot put a non-member on an expense" a
 * database guarantee instead of a service-layer check someone forgets.
 * Keep it in sync with the parent `expenses.group_id` inside the same
 * transaction — do not normalize this column away.
 */
export const expensePayers = pgTable(
  "expense_payers",
  {
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").notNull(),
    userId: uuid("user_id").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.expenseId, table.userId] }),
    check("expense_payers_amount_positive", sql`${table.amount} > 0`),
    foreignKey({
      columns: [table.groupId, table.userId],
      foreignColumns: [groupMembers.groupId, groupMembers.userId],
    }),
  ],
);

/**
 * Same denormalized-`group_id` reasoning as `expense_payers`. `weight`
 * keeps the raw input (shares, or basis points for `percentage`) so an
 * edit can round-trip the mode the expense was created in — `amount` is
 * always the resolved minor-unit value and the only thing the balance
 * engine reads.
 */
export const expenseSplits = pgTable(
  "expense_splits",
  {
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").notNull(),
    userId: uuid("user_id").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    weight: bigint("weight", { mode: "bigint" }),
  },
  (table) => [
    primaryKey({ columns: [table.expenseId, table.userId] }),
    check("expense_splits_amount_positive", sql`${table.amount} > 0`),
    foreignKey({
      columns: [table.groupId, table.userId],
      foreignColumns: [groupMembers.groupId, groupMembers.userId],
    }),
  ],
);

export const expenseRevisionAction = pgEnum("expense_revision_action", [
  "created",
  "updated",
  "deleted",
]);

/**
 * A full snapshot of the expense and its payer/split rows at each change —
 * shared-money history is the product; "this said I owed 40.000 yesterday"
 * has to be answerable (data-model.md). Written in the same transaction as
 * the change it records, never after. MVP writes these and exposes
 * "edited" + who + when; the full diff viewer is E9.
 */
export const expenseRevisions = pgTable(
  "expense_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    action: expenseRevisionAction("action").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("expense_revisions_expense_id_version_unique").on(table.expenseId, table.version)],
);

/**
 * A payment that actually happened — `from → to`, one amount, one
 * currency, one date (ADR-0009). Deliberately **not** linked to an
 * expense, a pair balance, or a plan edge: those are all derived and one
 * of them changes shape depending on a toggle, so attaching a settlement
 * to one would need a reconciliation step that this design avoids
 * entirely. It affects `net()` the same way an expense does — see
 * src/lib/money/balances.ts.
 *
 * No `version` column and no revisions table, unlike expenses: a
 * settlement is a single flat fact (one amount, one date, one note), so
 * there's nothing here that needs a diffable history the way a
 * multi-payer/multi-split expense does.
 */
export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    fromUserId: uuid("from_user_id").notNull(),
    toUserId: uuid("to_user_id").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    currency: char("currency", { length: 3 })
      .notNull()
      .references(() => currencies.code),
    // Calendar date only, same reasoning as expenses.expense_date.
    settledOn: date("settled_on", { mode: "string" }).notNull(),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("settlements_amount_positive", sql`${table.amount} > 0`),
    check("settlements_distinct_participants", sql`${table.fromUserId} <> ${table.toUserId}`),
    // Both participants must be current members of this group — the same
    // composite-FK trick expense_payers/expense_splits use, applied twice.
    foreignKey({
      columns: [table.groupId, table.fromUserId],
      foreignColumns: [groupMembers.groupId, groupMembers.userId],
    }),
    foreignKey({
      columns: [table.groupId, table.toUserId],
      foreignColumns: [groupMembers.groupId, groupMembers.userId],
    }),
    // The group feed's only query.
    index("settlements_group_id_settled_on_idx")
      .on(table.groupId, table.settledOn.desc())
      .where(sql`${table.deletedAt} IS NULL`),
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
