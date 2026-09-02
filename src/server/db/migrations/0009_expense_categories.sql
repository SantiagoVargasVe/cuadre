CREATE TABLE "expense_categories" (
	"key" text PRIMARY KEY NOT NULL,
	"sort_order" smallint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "category_key" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_key_expense_categories_key_fk" FOREIGN KEY ("category_key") REFERENCES "public"."expense_categories"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Hand-written: drizzle-kit only diffs schema.ts, not row data. Seeds the
-- six categories of T090's fixed taxonomy. Labels are NOT stored — they
-- live in src/lib/i18n/es.ts under categories.*. sort_order is the display
-- order and mirrors EXPENSE_CATEGORY_KEYS in src/lib/categories.ts. A
-- seventh category is a new migration with one more INSERT, never an
-- enum alter.
INSERT INTO "expense_categories" ("key", "sort_order") VALUES
	('comida', 1),
	('alojamiento', 2),
	('transporte', 3),
	('mercado', 4),
	('actividades', 5),
	('otro', 6);