-- Storage for the whole account-recovery epic (E15) in one migration:
-- the shared single-use token table, plus two new `users` columns. No
-- service code, no endpoints — T122 mints/consumes, T123 enforces
-- `sessions_valid_from`, T124 writes `email_verified_at`.
--
-- Only the SHA-256 of a token is ever stored in `auth_tokens`, and lookup
-- is by that hash. That is not Argon2id and it is not an oversight: a
-- 32-byte CSPRNG token is not guessable at any cost per attempt, so a
-- memory-hard hash would add ~100 ms and ~19 MB per lookup for nothing.
-- Hashing still matters so a leaked backup or a stray `SELECT *` in a log
-- can't hand over live links. See ADR-0012 § "Why SHA-256".
CREATE TYPE "public"."auth_token_purpose" AS ENUM('password_reset', 'email_verify');--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "auth_token_purpose" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Deliberately NOT backfilled. A blanket `email_verified_at = now()` would
-- mark every possibly-mistyped address as verified — the exact state
-- ADR-0013 exists to prevent. T118's `legacy_backfill` precedent does not
-- transfer: that recorded an operator's product decision about their own
-- instance; "this inbox is controlled" is a claim about the world nobody
-- checked. Every existing row stays null, and nobody is locked out
-- because verification gates only self-service reset, never login.
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
-- The `DEFAULT` expression doubles as the one-time backfill for rows that
-- already exist: Postgres evaluates it once for this transaction and fills
-- every existing row with the migration instant, truncated to the second.
-- That truncation is load-bearing — a JWT `iat` is whole seconds and
-- T123's check is a plain `iat >= sessions_valid_from`, so a fractional
-- value here would make the boundary a rounding exercise (ADR-0012 § "The
-- `iat` granularity trap").
--
-- The backfill value is chosen, not incidental: NOT epoch (which leaves
-- the column inert for every session that predates E15), and NOT a future
-- timestamp (which would bar re-login until it passed). At the migration
-- instant, sessions issued before the E15 deploy are retired and
-- re-established on next login — a one-time sign-in, not a lockout.
ALTER TABLE "users" ADD COLUMN "sessions_valid_from" timestamp with time zone DEFAULT date_trunc('second', now()) NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- "Delete this user's other outstanding tokens of this purpose" (T122) is
-- a real write path and is always purpose-scoped.
CREATE INDEX "auth_tokens_user_id_purpose_idx" ON "auth_tokens" USING btree ("user_id","purpose");
