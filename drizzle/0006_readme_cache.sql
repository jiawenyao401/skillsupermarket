-- Persist bounded README snapshots for crawl-stable Skill detail pages.
-- Additive and rollback-safe: older releases ignore these columns.
BEGIN;

CREATE TABLE IF NOT EXISTS "skill_readmes" (
  "skill_id" uuid PRIMARY KEY REFERENCES "skills" ("id") ON DELETE CASCADE,
  "content" text,
  "path" text,
  "html_url" text,
  "raw_url" text,
  "cached_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "skill_readmes_cached_at_idx"
  ON "skill_readmes" ("cached_at");

COMMIT;
