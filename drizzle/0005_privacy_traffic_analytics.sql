-- Privacy-preserving aggregate traffic and evaluation funnel telemetry.
-- No raw IP, user agent, full referrer, cookie ID or user identity is stored.
BEGIN;

CREATE TABLE IF NOT EXISTS "traffic_daily" (
  "date" date NOT NULL,
  "path" text NOT NULL,
  "source" text NOT NULL,
  "page_views" integer DEFAULT 0 NOT NULL,
  "evaluation_cta_clicks" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "traffic_daily_pk" PRIMARY KEY ("date", "path", "source"),
  CONSTRAINT "traffic_daily_path_check" CHECK ("path" LIKE '/%' AND length("path") <= 160),
  CONSTRAINT "traffic_daily_source_check" CHECK ("source" IN ('direct', 'internal', 'organic', 'github', 'community', 'referral')),
  CONSTRAINT "traffic_daily_page_views_check" CHECK ("page_views" >= 0),
  CONSTRAINT "traffic_daily_cta_clicks_check" CHECK ("evaluation_cta_clicks" >= 0)
);

CREATE INDEX IF NOT EXISTS "traffic_daily_date_idx" ON "traffic_daily" ("date");
CREATE INDEX IF NOT EXISTS "traffic_daily_source_date_idx" ON "traffic_daily" ("source", "date");

COMMIT;
