ALTER TABLE "evaluation_jobs"
  ADD COLUMN IF NOT EXISTS "attempt" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "max_attempts" integer DEFAULT 3 NOT NULL,
  ADD COLUMN IF NOT EXISTS "progress" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "stage" text DEFAULT 'queued' NOT NULL,
  ADD COLUMN IF NOT EXISTS "force_refresh" boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS "evaluation_jobs_status_created_idx"
  ON "evaluation_jobs" ("status", "created_at");

CREATE INDEX IF NOT EXISTS "evaluation_jobs_skill_status_idx"
  ON "evaluation_jobs" ("skill_id", "status");

-- Historical deployments may already contain duplicate active jobs. Keep the
-- oldest job active and close the redundant rows before enforcing idempotency.
WITH ranked_active_jobs AS (
  SELECT "id",
    row_number() OVER (
      PARTITION BY "skill_id"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS row_number
  FROM "evaluation_jobs"
  WHERE "status" IN ('pending', 'running')
)
UPDATE "evaluation_jobs"
SET "status" = 'failed',
    "stage" = 'superseded',
    "finished_at" = now(),
    "error" = 'Superseded by an earlier active evaluation job'
WHERE "id" IN (
  SELECT "id" FROM ranked_active_jobs WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "evaluation_jobs_one_active_per_skill_idx"
  ON "evaluation_jobs" ("skill_id")
  WHERE "status" IN ('pending', 'running');
