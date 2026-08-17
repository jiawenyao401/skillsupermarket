-- Server-authoritative roles for the private operations console.
BEGIN;

DO $$ BEGIN
  CREATE TYPE "user_role" AS ENUM ('user', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "role" "user_role" DEFAULT 'user' NOT NULL;

CREATE INDEX IF NOT EXISTS "user_role_idx" ON "user" ("role");

COMMIT;
