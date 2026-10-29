-- Existing codes remain single-use, including already consumed/expired links.
-- Only newly minted group links opt into reuse (ADR-0014).
ALTER TABLE "invite_codes" ADD COLUMN "reusable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "reusable_invite_requires_group_and_expiry" CHECK (NOT "invite_codes"."reusable" OR
      ("invite_codes"."group_id" IS NOT NULL AND "invite_codes"."expires_at" IS NOT NULL
       AND "invite_codes"."consumed_at" IS NULL AND "invite_codes"."consumed_by" IS NULL));
