import { sql } from "drizzle-orm";
import { customType, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
 * Single-use codes serving two purposes at once (ADR-0002): `group_id =
 * null` is a plain registration invite; `group_id` set is a group invite
 * that also registers you. Consumption is atomic with the user insert and,
 * when present, the membership insert — T011's job.
 *
 * `group_id` has no FK yet — `groups` doesn't exist until T020, which adds
 * it. `created_by` is nullable because `npm run seed:invite` mints the
 * very first code before any user exists.
 */
export const inviteCodes = pgTable(
  "invite_codes",
  {
    code: text("code").primaryKey(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    groupId: uuid("group_id"),
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
