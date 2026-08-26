CREATE TABLE "fx_rates" (
	"base_currency" char(3) NOT NULL,
	"quote_currency" char(3) NOT NULL,
	"rate" numeric(20, 10) NOT NULL,
	"as_of" date NOT NULL,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_base_currency_quote_currency_as_of_source_pk" PRIMARY KEY("base_currency","quote_currency","as_of","source")
);
--> statement-breakpoint
ALTER TABLE "fx_rates" ADD CONSTRAINT "fx_rates_base_currency_currencies_code_fk" FOREIGN KEY ("base_currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_rates" ADD CONSTRAINT "fx_rates_quote_currency_currencies_code_fk" FOREIGN KEY ("quote_currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
COMMENT ON TABLE "fx_rates" IS 'Append-only (currency.md § Storing rates). A pinned group may reference a past day''s rate; nothing may ever UPDATE or DELETE a row here, enforced in the fetch/refresh service, not by a DB constraint.';