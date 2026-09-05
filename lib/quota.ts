import "server-only";
import { createHmac } from "node:crypto";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { evaluationJobs, evaluationQuotaUsage, subscriptions, user } from "@/lib/schema";
import { assertVerifiedEmail } from "@/lib/email-verification";
import {
  FREE_WEEKLY_EVALUATION_LIMIT,
  getShanghaiWeekWindow,
  type QuotaSnapshot,
} from "@/lib/quota-policy";

export const FREE_NETWORK_WEEKLY_LIMIT = Math.max(
  FREE_WEEKLY_EVALUATION_LIMIT,
  Number(process.env.FREE_NETWORK_WEEKLY_LIMIT) || 20,
);

export class QuotaExceededError extends Error {
  constructor(
    public readonly code: "WEEKLY_QUOTA_EXCEEDED" | "FREE_NETWORK_QUOTA_EXCEEDED",
    public readonly quota: QuotaSnapshot,
  ) {
    super(code === "WEEKLY_QUOTA_EXCEEDED"
      ? "本周 10 次免费评测额度已用完，下周一自动恢复"
      : "该网络本周的免费评测额度已用完，请勿通过重复注册绕过额度限制");
    this.name = "QuotaExceededError";
  }
}

export class ActiveEvaluationRaceError extends Error {
  constructor() {
    super("An active evaluation was created concurrently");
    this.name = "ActiveEvaluationRaceError";
  }
}

export function getEvaluationNetworkKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("x-real-ip") || forwarded || "unknown";
  const secret = process.env.ABUSE_HASH_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("ABUSE_HASH_SECRET or BETTER_AUTH_SECRET must be configured");
  return createHmac("sha256", secret).update(`evaluation-network:${ip}`).digest("hex");
}

async function getActiveEntitlement(userId: string, now: Date) {
  const [subscription] = await db.select({
    plan: subscriptions.plan,
    weeklyEvaluationLimit: subscriptions.weeklyEvaluationLimit,
  }).from(subscriptions).where(and(
    eq(subscriptions.userId, userId),
    eq(subscriptions.status, "active"),
    or(isNull(subscriptions.currentPeriodEnd), gt(subscriptions.currentPeriodEnd, now)),
  )).limit(1);

  return subscription ?? { plan: "free" as const, weeklyEvaluationLimit: FREE_WEEKLY_EVALUATION_LIMIT };
}

export async function getQuotaSnapshot(userId: string, now = new Date()): Promise<QuotaSnapshot> {
  const window = getShanghaiWeekWindow(now);
  const [profile] = await db.select({ emailVerified: user.emailVerified }).from(user).where(eq(user.id, userId)).limit(1);
  if (!profile?.emailVerified) return {
    plan: "free", limit: 0, used: 0, remaining: 0,
    periodStart: window.periodStart, resetsAt: window.endsAt.toISOString(),
  };
  const entitlement = await getActiveEntitlement(userId, now);
  const [usage] = await db.select({ used: evaluationQuotaUsage.used })
    .from(evaluationQuotaUsage)
    .where(and(
      eq(evaluationQuotaUsage.subjectType, "user"),
      eq(evaluationQuotaUsage.subjectKey, userId),
      eq(evaluationQuotaUsage.periodStart, window.periodStart),
    ))
    .limit(1);
  const used = usage?.used ?? 0;
  return {
    plan: entitlement.plan,
    limit: entitlement.weeklyEvaluationLimit,
    used,
    remaining: Math.max(0, entitlement.weeklyEvaluationLimit - used),
    periodStart: window.periodStart,
    resetsAt: window.endsAt.toISOString(),
  };
}

type ConsumptionResult = { used: number };

export async function reserveQuotaAndCreateJob(input: {
  userId: string;
  networkKey: string;
  skillId: string;
  now?: Date;
}): Promise<{ job: typeof evaluationJobs.$inferSelect; quota: QuotaSnapshot }> {
  const now = input.now ?? new Date();
  const window = getShanghaiWeekWindow(now);
  const entitlement = await getActiveEntitlement(input.userId, now);

  return db.transaction(async (tx) => {
    const [profile] = await tx.select({ emailVerified: user.emailVerified }).from(user).where(eq(user.id, input.userId)).limit(1);
    assertVerifiedEmail(profile);
    const periodEnd = window.endsAt.toISOString();
    const [job] = await tx.insert(evaluationJobs).values({
      skillId: input.skillId,
      userId: input.userId,
      triggeredBy: "authenticated-user",
      status: "pending",
      stage: "queued",
      progress: 0,
      quotaPeriodStart: window.periodStart,
      quotaUnits: 1,
    }).onConflictDoNothing().returning();

    // The partial unique index on active jobs is the final concurrency guard.
    // Rolling back here also guarantees a duplicate submission consumes zero.
    if (!job) throw new ActiveEvaluationRaceError();

    const userRows = await tx.execute<ConsumptionResult>(sql`
      INSERT INTO evaluation_quota_usage
        (subject_type, subject_key, period_start, period_end, quota_limit, used)
      VALUES
        ('user', ${input.userId}, ${window.periodStart}::date, ${periodEnd}::timestamptz, ${entitlement.weeklyEvaluationLimit}, 1)
      ON CONFLICT (subject_type, subject_key, period_start)
      DO UPDATE SET
        used = evaluation_quota_usage.used + 1,
        quota_limit = EXCLUDED.quota_limit,
        period_end = EXCLUDED.period_end,
        updated_at = now()
      WHERE evaluation_quota_usage.used < EXCLUDED.quota_limit
      RETURNING used
    `);
    const userUsage = userRows[0]?.used;
    if (typeof userUsage !== "number") {
      throw new QuotaExceededError("WEEKLY_QUOTA_EXCEEDED", {
        plan: entitlement.plan,
        limit: entitlement.weeklyEvaluationLimit,
        used: entitlement.weeklyEvaluationLimit,
        remaining: 0,
        periodStart: window.periodStart,
        resetsAt: window.endsAt.toISOString(),
      });
    }

    // Paid customers have a verified economic identity and are not placed in
    // the shared free-network pool. Free accounts cannot multiply allowance by
    // repeatedly registering from the same source network.
    if (entitlement.plan === "free") {
      const networkRows = await tx.execute<ConsumptionResult>(sql`
        INSERT INTO evaluation_quota_usage
          (subject_type, subject_key, period_start, period_end, quota_limit, used)
        VALUES
          ('network', ${input.networkKey}, ${window.periodStart}::date, ${periodEnd}::timestamptz, ${FREE_NETWORK_WEEKLY_LIMIT}, 1)
        ON CONFLICT (subject_type, subject_key, period_start)
        DO UPDATE SET
          used = evaluation_quota_usage.used + 1,
          quota_limit = EXCLUDED.quota_limit,
          period_end = EXCLUDED.period_end,
          updated_at = now()
        WHERE evaluation_quota_usage.used < EXCLUDED.quota_limit
        RETURNING used
      `);
      if (typeof networkRows[0]?.used !== "number") {
        throw new QuotaExceededError("FREE_NETWORK_QUOTA_EXCEEDED", {
          plan: entitlement.plan,
          limit: entitlement.weeklyEvaluationLimit,
          used: userUsage,
          remaining: Math.max(0, entitlement.weeklyEvaluationLimit - userUsage),
          periodStart: window.periodStart,
          resetsAt: window.endsAt.toISOString(),
        });
      }
    }

    return {
      job,
      quota: {
        plan: entitlement.plan,
        limit: entitlement.weeklyEvaluationLimit,
        used: userUsage,
        remaining: Math.max(0, entitlement.weeklyEvaluationLimit - userUsage),
        periodStart: window.periodStart,
        resetsAt: window.endsAt.toISOString(),
      },
    };
  });
}
