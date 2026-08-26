CREATE TABLE "group_fx_pins" (
	"group_id" uuid NOT NULL,
	"from_currency" char(3) NOT NULL,
	"to_currency" char(3) NOT NULL,
	"rate" numeric(20, 10) NOT NULL,
	"as_of" date NOT NULL,
	"source" text NOT NULL,
	"pinned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pinned_by" uuid,
	CONSTRAINT "group_fx_pins_group_id_from_currency_to_currency_pk" PRIMARY KEY("group_id","from_currency","to_currency")
);
--> statement-breakpoint
ALTER TABLE "group_fx_pins" ADD CONSTRAINT "group_fx_pins_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_fx_pins" ADD CONSTRAINT "group_fx_pins_from_currency_currencies_code_fk" FOREIGN KEY ("from_currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_fx_pins" ADD CONSTRAINT "group_fx_pins_to_currency_currencies_code_fk" FOREIGN KEY ("to_currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_fx_pins" ADD CONSTRAINT "group_fx_pins_pinned_by_users_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;