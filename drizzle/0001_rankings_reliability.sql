WITH duplicate_ranks AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "period", "date", "rank" ORDER BY "id"
  ) AS row_number
  FROM "rankings"
)
DELETE FROM "rankings"
WHERE "id" IN (SELECT "id" FROM duplicate_ranks WHERE row_number > 1);

WITH duplicate_skills AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "period", "date", "skill_id" ORDER BY "rank", "id"
  ) AS row_number
  FROM "rankings"
)
DELETE FROM "rankings"
WHERE "id" IN (SELECT "id" FROM duplicate_skills WHERE row_number > 1);

CREATE UNIQUE INDEX IF NOT EXISTS "rankings_period_date_rank_unique_idx"
  ON "rankings" ("period", "date", "rank");

CREATE UNIQUE INDEX IF NOT EXISTS "rankings_period_date_skill_unique_idx"
  ON "rankings" ("period", "date", "skill_id");
