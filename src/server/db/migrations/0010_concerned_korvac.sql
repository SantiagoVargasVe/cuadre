CREATE TYPE "public"."legal_acceptance_source" AS ENUM('registration', 'legacy_backfill');--> statement-breakpoint
CREATE TYPE "public"."legal_document" AS ENUM('terms', 'privacy');--> statement-breakpoint
CREATE TABLE "legal_acceptances" (
	"user_id" uuid NOT NULL,
	"document" "legal_document" NOT NULL,
	"document_version" text NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "legal_acceptance_source" NOT NULL,
	CONSTRAINT "legal_acceptances_user_id_document_document_version_pk" PRIMARY KEY("user_id","document","document_version")
);
--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Hand-written: these rows are evidence, not current mutable state. New
-- versions are INSERTs; application code must never rewrite old evidence.
CREATE OR REPLACE FUNCTION prevent_legal_acceptance_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'legal acceptance records are immutable';
END;
$$;--> statement-breakpoint
CREATE TRIGGER legal_acceptances_immutable
BEFORE UPDATE OR DELETE ON legal_acceptances
FOR EACH ROW EXECUTE FUNCTION prevent_legal_acceptance_mutation();--> statement-breakpoint
-- Hand-written: every account that predates T118 is deliberately treated as
-- having acknowledged both initial documents at rollout time. The source
-- preserves that this is an assumption, not a fabricated historic click.
-- ON CONFLICT keeps the backfill non-destructive if this SQL is replayed.
INSERT INTO "legal_acceptances" (
	"user_id", "document", "document_version", "acknowledged_at", "source"
)
SELECT
	"users"."id",
	"documents"."document"::"legal_document",
	"documents"."document_version",
	CURRENT_TIMESTAMP,
	'legacy_backfill'::"legal_acceptance_source"
FROM "users"
CROSS JOIN (VALUES
	('terms', '2026-09-03'),
	('privacy', '2026-09-03')
) AS "documents" ("document", "document_version")
ON CONFLICT ("user_id", "document", "document_version") DO NOTHING;
