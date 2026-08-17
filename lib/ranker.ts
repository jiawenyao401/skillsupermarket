// 热度计算 + 榜单生成
import { db } from "./db";
import { skills, metricsDaily, rankings } from "./schema";
import { eq, sql, and, gte, lte, max } from "drizzle-orm";
import type { RankingPeriod } from "./types";

const RANKING_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Shanghai";

export function rankingDateKey(date: Date = new Date(), timeZone = RANKING_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function rankingWindowStart(period: RankingPeriod, date: Date = new Date()): string {
  const days = period === "daily" ? 1 : period === "weekly" ? 7 : 30;
  const endKey = rankingDateKey(date);
  const start = new Date(`${endKey}T12:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start.toISOString().slice(0, 10);
}

function snapshotAgeDays(snapshotDate: string, date: Date = new Date()): number {
  const current = new Date(`${rankingDateKey(date)}T12:00:00.000Z`);
  const snapshot = new Date(`${snapshotDate}T12:00:00.000Z`);
  return Math.max(0, Math.round((current.getTime() - snapshot.getTime()) / 86_400_000));
}

/**
 * 热度算法 (Hot Score)
 *
 * 综合考虑:
 *  - stars 增长 (40%): log 平滑, 鼓励新星
 *  - downloads 增长 (30%): log 平滑
 *  - 活跃度 (20%): 0-1 标量
 *  - 提及量 (10%): log 平滑
 *
 * 返回 0-1000 的分值, 越高越热
 */
export function calcHotScore(delta: {
  starsDelta: number;
  downloadsSignal: number;
  activityScore: number;
  mentionCount: number;
}): number {
  const starsPart = Math.log10(1 + Math.max(0, delta.starsDelta)) * 100;
  const dlPart = Math.log10(1 + Math.max(0, delta.downloadsSignal)) * 80;
  const actPart = delta.activityScore * 200; // 0-1 → 0-200
  const menPart = Math.log10(1 + Math.max(0, delta.mentionCount)) * 30;

  const raw =
    starsPart * 0.4 + dlPart * 0.3 + actPart * 0.2 + menPart * 0.1;

  // 截断到 0-1000
  return Math.max(0, Math.min(1000, Math.round(raw * 10) / 10));
}

/**
 * 计算指定 period 的榜单
 * period: daily (24h) / weekly (7d) / monthly (30d)
 */
export async function generateRankings(
  period: RankingPeriod,
  date: Date = new Date()
): Promise<{ skillId: string; score: number; rank: number }[]> {
  const days = period === "daily" ? 1 : period === "weekly" ? 7 : 30;
  const dateStr = rankingDateKey(date);
  const sinceStr = rankingWindowStart(period, date);

  // 聚合每个 skill 的 delta
  const aggregated = await db
    .select({
      skillId: metricsDaily.skillId,
      starsDelta: sql<number>`COALESCE(SUM(${metricsDaily.githubStarsDelta}), 0)`,
      activeDays: sql<number>`COUNT(DISTINCT CASE WHEN ${metricsDaily.githubStarsDelta} > 0 THEN ${metricsDaily.date} END)`,
      observedDays: sql<number>`COUNT(DISTINCT ${metricsDaily.date})`,
      latestDownloads: sql<number>`(ARRAY_AGG(COALESCE(${metricsDaily.npmDownloadsWeekly}, 0) + COALESCE(${metricsDaily.pypiDownloadsWeekly}, 0) ORDER BY ${metricsDaily.date} DESC))[1]`,
      earliestDownloads: sql<number>`(ARRAY_AGG(COALESCE(${metricsDaily.npmDownloadsWeekly}, 0) + COALESCE(${metricsDaily.pypiDownloadsWeekly}, 0) ORDER BY ${metricsDaily.date} ASC))[1]`,
      currentStars: sql<number>`MAX(COALESCE(${metricsDaily.githubStars}, 0))`,
      lastCommit: sql<Date | null>`MAX(${skills.githubLastCommit})`,
    })
    .from(metricsDaily)
    .innerJoin(skills, eq(skills.id, metricsDaily.skillId))
    .where(and(
      gte(metricsDaily.date, sinceStr),
      lte(metricsDaily.date, dateStr),
      eq(skills.status, "active")
    ))
    .groupBy(metricsDaily.skillId);

  const scored = aggregated.map((row) => {
    const observedDays = Math.max(1, Math.min(days, Number(row.observedDays)));
    const growthActivity = Math.min(1, Number(row.activeDays) / observedDays);
    const lastCommit = row.lastCommit ? new Date(row.lastCommit) : null;
    const commitAgeDays = lastCommit ? Math.max(0, (date.getTime() - lastCommit.getTime()) / 86_400_000) : Number.POSITIVE_INFINITY;
    const maintenanceActivity = commitAgeDays <= 7 ? 1 : commitAgeDays <= 30 ? 0.8 : commitAgeDays <= 90 ? 0.55 : commitAgeDays <= 180 ? 0.3 : 0.1;
    const activityScore = maintenanceActivity * 0.65 + growthActivity * 0.35;
    const latestDownloads = Number(row.latestDownloads) || 0;
    const downloadMomentum = Math.max(0, latestDownloads - (Number(row.earliestDownloads) || 0));
    // Weekly registry downloads are already a recent-demand signal. A small
    // adoption component keeps new packages rankable before two snapshots exist.
    const downloadsSignal = downloadMomentum + latestDownloads * 0.02;
    return {
      skillId: row.skillId,
      score: calcHotScore({
        starsDelta: Number(row.starsDelta),
        downloadsSignal,
        activityScore,
        mentionCount: 0, // 简化: 暂未采集
      }),
      tieBreaker: Number(row.currentStars) + latestDownloads / 100,
    };
  });

  // 排序 + 给 rank
  scored.sort((a, b) => b.score - a.score || b.tieBreaker - a.tieBreaker || a.skillId.localeCompare(b.skillId));
  const ranked = scored.map(({ tieBreaker: _tieBreaker, ...item }, i) => ({ ...item, rank: i + 1 }));

  return ranked;
}

/**
 * 写入 rankings 表
 */
export async function saveRankings(
  period: RankingPeriod,
  date: Date = new Date()
): Promise<number> {
  const dateStr = rankingDateKey(date);
  const ranked = await generateRankings(period, date);

  if (ranked.length === 0) return 0;

  await db.transaction(async (tx) => {
    await tx.delete(rankings).where(and(eq(rankings.period, period), eq(rankings.date, dateStr)));
    await tx.insert(rankings).values(ranked.map((r) => ({
      period,
      date: dateStr,
      rank: r.rank,
      skillId: r.skillId,
      score: r.score.toString(),
    })));
  });

  return ranked.length;
}

/**
 * 读取榜单
 */
export async function getRankings(
  period: RankingPeriod,
  limit: number = 20
) {
  const [snapshot] = await db.select({ date: max(rankings.date) })
    .from(rankings)
    .where(eq(rankings.period, period));
  const snapshotDate = snapshot?.date ?? null;
  if (!snapshotDate) return { snapshotDate: null, ageDays: null, isStale: true, items: [] };

  const items = await db
    .select({
      rank: rankings.rank,
      score: rankings.score,
      skillId: rankings.skillId,
      // join skill
      slug: skills.slug,
      name: skills.name,
      description: skills.description,
      type: skills.type,
      category: skills.category,
      tags: skills.tags,
      authorName: skills.authorName,
      authorAvatar: skills.authorAvatar,
      githubStars: skills.githubStars,
      license: skills.license,
    })
    .from(rankings)
    .innerJoin(skills, eq(skills.id, rankings.skillId))
    .where(and(eq(rankings.period, period), eq(rankings.date, snapshotDate)))
    .orderBy(rankings.rank)
    .limit(limit);
  const ageDays = snapshotAgeDays(snapshotDate);
  return { snapshotDate, ageDays, isStale: ageDays > 1, items };
}
