CREATE TYPE "public"."split_strategy" AS ENUM('equal', 'equal_subset', 'shares', 'percentage', 'exact', 'loan');--> statement-breakpoint
CREATE TABLE "expense_payers" (
	"expense_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "expense_payers_expense_id_user_id_pk" PRIMARY KEY("expense_id","user_id"),
	CONSTRAINT "expense_payers_amount_positive" CHECK ("expense_payers"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "expense_splits" (
	"expense_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"weight" bigint,
	CONSTRAINT "expense_splits_expense_id_user_id_pk" PRIMARY KEY("expense_id","user_id"),
	CONSTRAINT "expense_splits_amount_positive" CHECK ("expense_splits"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"title" text NOT NULL,
	"expense_date" date NOT NULL,
	"total_amount" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"split_strategy" "split_strategy" NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_total_amount_positive" CHECK ("expenses"."total_amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "expense_payers" ADD CONSTRAINT "expense_payers_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_payers" ADD CONSTRAINT "expense_payers_group_id_user_id_group_members_group_id_user_id_fk" FOREIGN KEY ("group_id","user_id") REFERENCES "public"."group_members"("group_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_group_id_user_id_group_members_group_id_user_id_fk" FOREIGN KEY ("group_id","user_id") REFERENCES "public"."group_members"("group_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_group_id_expense_date_idx" ON "expenses" USING btree ("group_id","expense_date" DESC NULLS LAST) WHERE "expenses"."deleted_at" IS NULL;--> statement-breakpoint
-- Hand-written: drizzle-kit only diffs schema.ts, it cannot express a
-- trigger. This is the balanced-expense constraint from ADR-0005 —
-- sum(expense_payers.amount) == expenses.total_amount ==
-- sum(expense_splits.amount) — enforced by the database so no future code
-- path (a data-fix script, a migration, an admin tool nobody has written
-- yet) can write an unbalanced expense even if it skips the service.
--
-- It MUST be a DEFERRED constraint trigger, not a plain one: a single
-- expense write inserts three rows (the expense, its payers, its splits)
-- in one transaction, in whatever order the service happens to insert
-- them, and an immediate trigger would fire after the first row lands —
-- before the other two exist — and reject a perfectly balanced write.
-- Deferring to commit time means every row is visible by the time any of
-- them gets checked.
--
-- Attached to all three tables (not just `expenses`) because a write can
-- touch any of them — including, from T035 onward, an edit that deletes
-- and re-inserts split rows. Each attached trigger re-validates the same
-- expense from scratch, so firing more than once per statement is
-- redundant but harmless: they all see the same fully-committed state and
-- agree.
--
-- Do NOT "simplify" this to a single trigger on `expenses` alone — that
-- would silently stop catching an unbalanced UPDATE or DELETE on
-- expense_payers/expense_splits.
CREATE FUNCTION "check_expense_balance"() RETURNS trigger AS $$
DECLARE
	v_expense_id uuid;
	v_total bigint;
	v_payers_sum bigint;
	v_splits_sum bigint;
BEGIN
	IF TG_TABLE_NAME = 'expenses' THEN
		v_expense_id := NEW.id;
	ELSE
		v_expense_id := COALESCE(NEW.expense_id, OLD.expense_id);
	END IF;

	SELECT total_amount INTO v_total FROM expenses WHERE id = v_expense_id;
	SELECT COALESCE(SUM(amount), 0) INTO v_payers_sum FROM expense_payers WHERE expense_id = v_expense_id;
	SELECT COALESCE(SUM(amount), 0) INTO v_splits_sum FROM expense_splits WHERE expense_id = v_expense_id;

	IF v_payers_sum <> v_total OR v_splits_sum <> v_total THEN
		RAISE EXCEPTION
			'Unbalanced expense %: total=%, payers_sum=%, splits_sum=%',
			v_expense_id, v_total, v_payers_sum, v_splits_sum;
	END IF;

	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "expenses_balance_check"
	AFTER INSERT OR UPDATE ON "expenses"
	DEFERRABLE INITIALLY DEFERRED
	FOR EACH ROW EXECUTE FUNCTION check_expense_balance();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "expense_payers_balance_check"
	AFTER INSERT OR UPDATE OR DELETE ON "expense_payers"
	DEFERRABLE INITIALLY DEFERRED
	FOR EACH ROW EXECUTE FUNCTION check_expense_balance();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "expense_splits_balance_check"
	AFTER INSERT OR UPDATE OR DELETE ON "expense_splits"
	DEFERRABLE INITIALLY DEFERRED
	FOR EACH ROW EXECUTE FUNCTION check_expense_balance();