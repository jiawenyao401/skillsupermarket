// 评测主流程: 协调 scanner + judge + 数据采集
import { db } from "./db";
import { skills, evaluations, evaluationJobs } from "./schema";
import { eq, desc } from "drizzle-orm";
import { scanText } from "./scanner";
import { judgeSkill } from "./judge";
import { getReadme } from "./github";
import { getNpmWeeklyDownloads } from "./npm";
import type {
  EvaluationReport,
  PopularityStats,
  SecurityFinding,
} from "./types";

export interface EvaluateOptions {
  skillId: string;
  triggeredBy?: string;
}

/**
 * 单个 skill 评测
 * 1. 拉 README
 * 2. 跑安全扫描
 * 3. 跑 LLM Judge
 * 4. 算流行度 / 活跃度
 * 5. 汇总 → 写库
 */
export async function evaluateSkill(opts: EvaluateOptions): Promise<string> {
  const { skillId, triggeredBy = "auto-v1" } = opts;

  // 1. 写 job: running
  const [job] = await db
    .insert(evaluationJobs)
    .values({ skillId, triggeredBy, status: "running", startedAt: new Date() })
    .returning();
  if (!job) throw new Error("无法创建评测任务");

  try {
    // 2. 拿 skill 信息
    const [skill] = await db
      .select()
      .from(skills)
      .where(eq(skills.id, skillId));
    if (!skill) throw new Error(`Skill ${skillId} 不存在`);

    // 3. 拉 README
    let readme = "";
    if (skill.repoUrl) {
      const match = skill.repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
      if (match) {
        readme = (await getReadme(match[1])) ?? "";
      }
    }
    if (!readme && skill.description) {
      readme = skill.description;
    }

    // 4. 跑安全扫描
    const secResult = scanText(readme);
    const secFindings: SecurityFinding[] = secResult.findings;

    // 5. 跑 LLM Judge
    let qualityScore = 0;
    let qualityDetails = "跳过 (无 LLM API Key)";
    let qualityComment = "";
    if (
      process.env.DEEPSEEK_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY
    ) {
      try {
        const result = await judgeSkill({
          name: skill.name,
          type: skill.type,
          description: skill.description ?? "",
          readme,
        });
        qualityScore = result.score;
        qualityDetails = result.details;
        qualityComment = result.comment;
      } catch (err) {
        console.error(`[evaluator] judge failed for ${skill.slug}:`, err);
        qualityDetails = `LLM Judge 失败: ${(err as Error).message}`;
      }
    }

    // 6. 算文档分
    const docScore = scoreDocumentation(readme, skill.description);

    // 7. 算流行度
    const popStats: PopularityStats = {
      stars: skill.githubStars ?? 0,
      forks: skill.githubForks ?? 0,
      downloadsWeekly: (skill.npmDownloadsWeekly ?? 0) + (skill.pypiDownloadsWeekly ?? 0),
      starsGrowth7d: 0, // TODO: 查 metrics_daily
      starsGrowth30d: 0,
    };
    const popScore = scorePopularity(popStats);

    // 8. 算活跃度
    const actScore = scoreActivity(skill.githubLastCommit);

    // 9. 算总分
    const overall = Math.round(
      docScore * 0.2 +
        secResult.score * 0.2 +
        popScore * 0.2 +
        actScore * 0.1 +
        qualityScore * 0.3
    );

    const report: EvaluationReport = {
      documentation: { score: docScore, details: describeDocScore(docScore) },
      security: {
        score: secResult.score,
        details: secResult.details,
        findings: secFindings,
      },
      popularity: { score: popScore, details: describePopScore(popStats), stats: popStats },
      activity: { score: actScore, details: describeActScore(skill.githubLastCommit) },
      quality: {
        score: qualityScore,
        details: qualityDetails,
        llmComment: qualityComment,
      },
      overall,
    };

    // 10. 写 evaluation
    const [ev] = await db
      .insert(evaluations)
      .values({
        skillId,
        overallScore: overall,
        documentationScore: docScore,
        securityScore: secResult.score,
        popularityScore: popScore,
        activityScore: actScore,
        qualityScore,
        report,
        evaluatedBy: triggeredBy,
      })
      .returning();

    // 11. 更新 job: done
    await db
      .update(evaluationJobs)
      .set({ status: "done", finishedAt: new Date() })
      .where(eq(evaluationJobs.id, job.id));

    if (!ev) throw new Error("评测写入失败");
    return ev.id;
  } catch (err) {
    await db
      .update(evaluationJobs)
      .set({
        status: "failed",
        finishedAt: new Date(),
        error: (err as Error).message,
      })
      .where(eq(evaluationJobs.id, job.id));
    throw err;
  }
}

// === 评分细节 ===

function scoreDocumentation(readme: string, description: string | null): number {
  let score = 0;
  if (description && description.length > 30) score += 20;
  if (readme.length > 500) score += 30;
  if (readme.length > 2000) score += 20;
  if (/```[\s\S]*?```/.test(readme)) score += 15; // 有代码块
  if (/#{1,3}\s+/m.test(readme)) score += 15; // 有标题
  return Math.min(100, score);
}

function describeDocScore(score: number): string {
  if (score >= 80) return "文档非常完整";
  if (score >= 60) return "文档较完整";
  if (score >= 40) return "文档基础";
  return "文档不足";
}

function scorePopularity(stats: PopularityStats): number {
  // log 平滑
  const starPart = Math.log10(1 + stats.stars) * 25; // 10k stars ≈ 100
  const dlPart = Math.log10(1 + stats.downloadsWeekly) * 15; // 1M downloads ≈ 45
  return Math.min(100, Math.round(starPart + dlPart));
}

function describePopScore(stats: PopularityStats): string {
  return `⭐ ${stats.stars} stars · 📦 ${stats.downloadsWeekly}/周下载`;
}

function scoreActivity(lastCommit: Date | null): number {
  if (!lastCommit) return 0;
  const days = (Date.now() - lastCommit.getTime()) / 86400000;
  if (days <= 7) return 100;
  if (days <= 30) return 80;
  if (days <= 90) return 50;
  if (days <= 180) return 30;
  if (days <= 365) return 10;
  return 0;
}

function describeActScore(lastCommit: Date | null): string {
  if (!lastCommit) return "无 commit 记录";
  const days = Math.floor((Date.now() - lastCommit.getTime()) / 86400000);
  if (days === 0) return "今天活跃";
  if (days === 1) return "昨天活跃";
  return `${days} 天前活跃`;
}

/**
 * 评测队列 worker
 * 每批处理 N 个
 */
export async function processEvaluationQueue(batchSize: number = 5): Promise<number> {
  const pending = await db
    .select()
    .from(evaluationJobs)
    .where(eq(evaluationJobs.status, "pending"))
    .limit(batchSize);

  let processed = 0;
  for (const job of pending) {
    try {
      await evaluateSkill({ skillId: job.skillId, triggeredBy: job.triggeredBy ?? "queue" });
      processed++;
    } catch (err) {
      console.error(`[evaluator] failed for job ${job.id}:`, err);
    }
  }
  return processed;
}
