-- Production billing entitlements and weekly evaluation quota ledger.
BEGIN;

DO $$ BEGIN
  CREATE TYPE "billing_plan" AS ENUM ('free', 'pro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "billing_status" AS ENUM ('active', 'past_due', 'canceled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "quota_subject" AS ENUM ('user', 'network');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "plan" "billing_plan" DEFAULT 'pro' NOT NULL,
  "status" "billing_status" DEFAULT 'active' NOT NULL,
  "weekly_evaluation_limit" integer DEFAULT 100 NOT NULL CHECK ("weekly_evaluation_limit" > 0),
  "provider" text,
  "provider_customer_id" text,
  "provider_subscription_id" text,
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_user_unique_idx" ON "subscriptions" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_provider_subscription_unique_idx" ON "subscriptions" ("provider", "provider_subscription_id");
CREATE INDEX IF NOT EXISTS "subscriptions_status_period_idx" ON "subscriptions" ("status", "current_period_end");

CREATE TABLE IF NOT EXISTS "evaluation_quota_usage" (
  "subject_type" "quota_subject" NOT NULL,
  "subject_key" text NOT NULL,
  "period_start" date NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "quota_limit" integer NOT NULL CHECK ("quota_limit" > 0),
  "used" integer DEFAULT 0 NOT NULL CHECK ("used" >= 0 AND "used" <= "quota_limit"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "evaluation_quota_usage_pk" PRIMARY KEY ("subject_type", "subject_key", "period_start")
);

CREATE INDEX IF NOT EXISTS "evaluation_quota_usage_period_end_idx" ON "evaluation_quota_usage" ("period_end");

ALTER TABLE "evaluation_jobs" ADD COLUMN IF NOT EXISTS "quota_period_start" date;
ALTER TABLE "evaluation_jobs" ADD COLUMN IF NOT EXISTS "quota_units" integer DEFAULT 0 NOT NULL;
ALTER TABLE "evaluation_jobs" DROP CONSTRAINT IF EXISTS "evaluation_jobs_quota_units_check";
ALTER TABLE "evaluation_jobs" ADD CONSTRAINT "evaluation_jobs_quota_units_check" CHECK ("quota_units" IN (0, 1));

COMMIT;
