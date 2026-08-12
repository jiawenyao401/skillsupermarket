// 热度计算 + 榜单生成
import { db } from "./db";
import { skills, metricsDaily, rankings } from "./schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import type { RankingPeriod } from "./types";

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
  downloadsDelta: number;
  activityScore: number;
  mentionCount: number;
}): number {
  const starsPart = Math.log10(1 + Math.max(0, delta.starsDelta)) * 100;
  const dlPart = Math.log10(1 + Math.max(0, delta.downloadsDelta)) * 80;
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
  const since = new Date(date);
  since.setDate(since.getDate() - days);

  // 聚合每个 skill 的 delta
  const aggregated = await db
    .select({
      skillId: metricsDaily.skillId,
      starsDelta: sql<number>`COALESCE(SUM(${metricsDaily.githubStarsDelta}), 0)`,
      // 简化的活跃度: 当天有 commit 记 1
      activeDays: sql<number>`COUNT(CASE WHEN ${metricsDaily.githubStarsDelta} > 0 THEN 1 END)`,
    })
    .from(metricsDaily)
    .where(gte(metricsDaily.date, since.toISOString().split("T")[0]))
    .groupBy(metricsDaily.skillId);

  const scored = aggregated.map((row) => {
    const activityScore = Math.min(1, row.activeDays / days);
    return {
      skillId: row.skillId,
      score: calcHotScore({
        starsDelta: Number(row.starsDelta),
        downloadsDelta: 0, // 简化: 暂未采集
        activityScore,
        mentionCount: 0, // 简化: 暂未采集
      }),
    };
  });

  // 排序 + 给 rank
  scored.sort((a, b) => b.score - a.score);
  const ranked = scored.map((s, i) => ({ ...s, rank: i + 1 }));

  return ranked;
}

/**
 * 写入 rankings 表
 */
export async function saveRankings(
  period: RankingPeriod,
  date: Date = new Date()
): Promise<number> {
  const dateStr = date.toISOString().split("T")[0];
  const ranked = await generateRankings(period, date);

  if (ranked.length === 0) return 0;

  // 删除当日已存在的
  await db
    .delete(rankings)
    .where(and(eq(rankings.period, period), eq(rankings.date, dateStr)));

  // 批量插入
  await db.insert(rankings).values(
    ranked.map((r) => ({
      period,
      date: dateStr,
      rank: r.rank,
      skillId: r.skillId,
      score: r.score.toString(),
    }))
  );

  return ranked.length;
}

/**
 * 读取榜单
 */
export async function getRankings(
  period: RankingPeriod,
  limit: number = 20
) {
  const dateStr = new Date().toISOString().split("T")[0];
  return db
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
    .where(and(eq(rankings.period, period), eq(rankings.date, dateStr)))
    .orderBy(rankings.rank)
    .limit(limit);
}
