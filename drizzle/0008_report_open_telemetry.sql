-- Count explicit clicks from the public skill-detail lead to its evaluation.
-- Daily aggregate only; older releases ignore this additive column.
BEGIN;

ALTER TABLE "traffic_daily"
  ADD COLUMN IF NOT EXISTS "report_open_clicks" integer DEFAULT 0 NOT NULL;

DO $$
BEGIN
  ALTER TABLE "traffic_daily"
    ADD CONSTRAINT "traffic_daily_report_open_clicks_check"
    CHECK ("report_open_clicks" >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
