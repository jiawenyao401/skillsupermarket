export const FREE_WEEKLY_EVALUATION_LIMIT = 10;

export type PlanCode = "free" | "pro";

export interface QuotaSnapshot {
  plan: PlanCode;
  limit: number;
  used: number;
  remaining: number;
  periodStart: string;
  resetsAt: string;
}

export interface WeekWindow {
  periodStart: string;
  startsAt: Date;
  endsAt: Date;
}

// Billing periods are product-facing China Standard Time weeks: Monday 00:00
// through the following Monday 00:00. China has no daylight-saving changes.
export function getShanghaiWeekWindow(now = new Date()): WeekWindow {
  const chinaOffsetMs = 8 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + chinaOffsetMs);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const localMondayMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday);
  const startsAt = new Date(localMondayMs - chinaOffsetMs);
  const endsAt = new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { periodStart: new Date(localMondayMs).toISOString().slice(0, 10), startsAt, endsAt };
}
