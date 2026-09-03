-- Measure guide-to-guide continuation without storing visitor identity or targets.
-- Additive and rollback-safe: older releases ignore this aggregate counter.
BEGIN;

ALTER TABLE "traffic_daily"
  ADD COLUMN IF NOT EXISTS "guide_continuation_clicks" integer DEFAULT 0 NOT NULL;

DO $$
BEGIN
  ALTER TABLE "traffic_daily"
    ADD CONSTRAINT "traffic_daily_guide_continuation_clicks_check"
    CHECK ("guide_continuation_clicks" >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
