CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"tokens" numeric NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
