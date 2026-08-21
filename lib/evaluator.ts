import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { evaluations, evaluationJobs, metricsDaily, skills } from "./schema";
import { scanDocuments } from "./scanner";
import { hasJudgeConfiguration, judgeSkill, type JudgeResult } from "./judge";
import {
  buildSummary,
  calculateConfidence,
  calculateOverallScore,
  combineQualityScore,
  deterministicQualityScore,
  EVALUATOR_VERSION,
  scoreActivity,
  scoreDocumentation,
  scorePopularity,
  WEIGHTS,
} from "./evaluation-scoring";
import { getEvaluationFiles, getReadme, getRepo } from "./github";
import { getNpmWeeklyDownloads } from "./npm";
import { getPypiWeeklyDownloads } from "./pypi";
import type {
  EvaluationReport,
  PopularityStats,
} from "./types";

const STALE_RUNNING_MINUTES = 15;

export { buildSummary, clamp, EVALUATOR_VERSION, WEIGHTS } from "./evaluation-scoring";

export interface EvaluateOptions {
  skillId: string;
  jobId?: string;
  triggeredBy?: string;
  requireAIJudge?: boolean;
}

async function updateJob(jobId: string, values: Partial<typeof evaluationJobs.$inferInsert>) {
  await db.update(evaluationJobs).set(values).where(eq(evaluationJobs.id, jobId));
}

function inferDocumentKind(path: string): "documentation" | "instruction" | "code" | "manifest" {
  const normalized = path.toLowerCase();
  if (normalized.includes("skill.md")) return "instruction";
  if (normalized.endsWith(".json") || normalized.endsWith(".toml") || normalized.includes("requirements")) return "manifest";
  if (/dockerfile|\.ya?ml$|\.js$|\.ts$|\.py$/.test(normalized)) return "code";
  return "documentation";
}

async function resolveJob(options: EvaluateOptions): Promise<typeof evaluationJobs.$inferSelect> {
  if (options.jobId) {
    const [existing] = await db.select().from(evaluationJobs).where(eq(evaluationJobs.id, options.jobId)).limit(1);
    if (!existing) throw new Error("评测任务不存在");
    return existing;
  }
  const [created] = await db.insert(evaluationJobs).values({
    skillId: options.skillId,
    triggeredBy: options.triggeredBy ?? "manual",
    status: "running",
    startedAt: new Date(),
    attempt: 1,
    stage: "metadata",
    progress: 5,
  }).returning();
  if (!created) throw new Error("无法创建评测任务");
  return created;
}

export async function evaluateSkill(options: EvaluateOptions): Promise<string> {
  const job = await resolveJob(options);
  const triggeredBy = options.triggeredBy ?? job.triggeredBy ?? `evaluator-v${EVALUATOR_VERSION}`;
  try {
    await updateJob(job.id, { status: "running", startedAt: job.startedAt ?? new Date(), stage: "metadata", progress: 8 });
    const [skill] = await db.select().from(skills).where(eq(skills.id, options.skillId)).limit(1);
    if (!skill) throw new Error("Skill 不存在");

    let readme = "";
    let repoFullName: string | null = null;
    const match = skill.repoUrl?.match(/github\.com\/([^/]+\/[^/?#]+)/i);
    if (match) repoFullName = match[1].replace(/\.git$/i, "");

    await updateJob(job.id, { stage: "evidence", progress: 20 });
    const [repo, readmeResult] = await Promise.all([
      repoFullName ? getRepo(repoFullName) : Promise.resolve(null),
      repoFullName ? getReadme(repoFullName) : Promise.resolve(null),
    ]);
    const extraFiles = repoFullName ? await getEvaluationFiles(repoFullName, repo?.default_branch) : [];
    readme = readmeResult ?? skill.description ?? "";

    const documents = [
      { path: "README.md", content: readme, kind: "documentation" as const },
      ...extraFiles
        .filter((file) => file.path.toLowerCase() !== "readme.md")
        .map((file) => ({ path: file.path, content: file.content, kind: inferDocumentKind(file.path) })),
    ];
    const filePaths = documents.map((document) => document.path);
    const documentation = scoreDocumentation(readme, skill.description, filePaths);

    await updateJob(job.id, { stage: "security", progress: 40 });
    const security = scanDocuments(documents);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const metricRows = await db.select().from(metricsDaily).where(and(
      eq(metricsDaily.skillId, skill.id),
      gte(metricsDaily.date, thirtyDaysAgo.toISOString().slice(0, 10))
    )).orderBy(asc(metricsDaily.date));
    const growth30 = metricRows.reduce((sum, row) => sum + (row.githubStarsDelta ?? 0), 0);
    const growth7 = metricRows.slice(-7).reduce((sum, row) => sum + (row.githubStarsDelta ?? 0), 0);

    const isNpm = skill.packageUrl?.includes("npmjs.com/package/");
    const isPypi = skill.packageUrl?.includes("pypi.org/project/");
    const packageName = isNpm
      ? decodeURIComponent(skill.packageUrl!.split("/package/")[1].replace(/\/$/, ""))
      : isPypi
        ? decodeURIComponent(skill.packageUrl!.split("/project/")[1].replace(/\/$/, ""))
        : null;
    const liveDownloads = packageName
      ? isNpm ? await getNpmWeeklyDownloads(packageName) : await getPypiWeeklyDownloads(packageName)
      : 0;
    const popStats: PopularityStats = {
      stars: repo?.stargazers_count ?? skill.githubStars ?? 0,
      forks: repo?.forks_count ?? skill.githubForks ?? 0,
      downloadsWeekly: liveDownloads || (skill.npmDownloadsWeekly ?? 0) + (skill.pypiDownloadsWeekly ?? 0),
      starsGrowth7d: growth7,
      starsGrowth30d: growth30,
    };
    const popularityScore = scorePopularity(popStats);
    const lastCommit = repo?.pushed_at ? new Date(repo.pushed_at) : skill.githubLastCommit;
    const activityScore = scoreActivity(lastCommit, repo?.open_issues_count ?? skill.githubOpenIssues ?? 0, popStats.stars);
    const deterministicQuality = deterministicQualityScore(documentation, filePaths, Boolean(skill.license ?? repo?.license), Boolean(repoFullName), skill.type);

    await updateJob(job.id, { stage: "quality", progress: 66 });
    let aiResult: JudgeResult | null = null;
    let aiFailure: string | null = null;
    if (hasJudgeConfiguration()) {
      try {
        aiResult = await judgeSkill({
          name: skill.name,
          type: skill.type,
          description: skill.description ?? "",
          readme,
          deterministicEvidence: documentation.checks.map((check) => `${check.passed ? "通过" : "缺失"}: ${check.label}`),
        });
      } catch (error) {
        aiFailure = error instanceof Error ? error.message : "LLM Judge 失败";
        console.error(`[evaluator] AI judge failed for ${skill.slug}:`, error);
      }
    } else {
      aiFailure = "未配置可用的 LLM Judge";
    }
    if (options.requireAIJudge && !aiResult) {
      throw new Error(`案例评测要求 AI Judge 成功：${aiFailure ?? "未获得有效结果"}`);
    }
    const qualityScore = combineQualityScore(deterministicQuality, aiResult?.score ?? null);
    const overall = calculateOverallScore({
      documentation: documentation.score,
      security: security.score,
      popularity: popularityScore,
      activity: activityScore,
      quality: qualityScore,
      riskLevel: security.riskLevel,
    });

    const confidence = calculateConfidence({
      readmeLength: readme.length,
      fileCount: documents.length,
      aiJudgeUsed: Boolean(aiResult),
      hasRepoMetadata: Boolean(repo),
      hasActivity: Boolean(lastCommit),
    });
    const summary = buildSummary(overall, security.riskLevel, confidence);
    const concerns = [
      ...security.findings.slice(0, 3).map((finding) => finding.message),
      ...documentation.improvements.slice(0, 3).map((item) => `缺少${item}`),
      ...(aiResult?.concerns ?? []),
    ].filter((value, index, values) => values.indexOf(value) === index).slice(0, 6);
    const strengths = [
      ...documentation.strengths,
      ...(security.riskLevel === "low" ? ["未发现已知高风险模式"] : []),
      ...(aiResult?.strengths ?? []),
    ].filter((value, index, values) => values.indexOf(value) === index).slice(0, 6);

    await updateJob(job.id, { stage: "report", progress: 88 });
    const report: EvaluationReport = {
      version: EVALUATOR_VERSION,
      summary,
      documentation,
      security: {
        score: security.score,
        details: security.details,
        findings: security.findings,
        riskLevel: security.riskLevel,
        scannedFiles: security.scannedFiles,
        scannedCharacters: security.scannedCharacters,
      },
      popularity: {
        score: popularityScore,
        details: `${popStats.stars.toLocaleString()} Stars · ${popStats.downloadsWeekly.toLocaleString()} 周下载 · 30 天增长 ${popStats.starsGrowth30d >= 0 ? "+" : ""}${popStats.starsGrowth30d}`,
        stats: popStats,
      },
      activity: {
        score: activityScore,
        details: lastCommit ? `最近提交于 ${lastCommit.toISOString().slice(0, 10)}` : "未获得有效提交记录",
        lastCommitAt: lastCommit?.toISOString() ?? null,
      },
      quality: {
        score: qualityScore,
        details: aiResult?.details ?? `确定性工程质量 ${deterministicQuality}/100${aiFailure ? " · AI 复核暂不可用" : ""}`,
        llmComment: aiResult?.comment,
        deterministicScore: deterministicQuality,
        aiScore: aiResult?.score ?? null,
        subScores: aiResult?.scores,
        evidence: aiResult?.evidence,
      },
      recommendation: {
        strengths,
        concerns,
        bestFor: aiResult?.bestFor ?? [],
        avoidFor: aiResult?.avoidFor ?? (security.riskLevel === "critical" ? ["生产环境与敏感数据场景"] : []),
        nextActions: [
          ...security.findings.slice(0, 3).map((finding) => finding.remediation).filter((item): item is string => Boolean(item)),
          ...documentation.improvements.slice(0, 3).map((item) => `补充${item}`),
        ].filter((value, index, values) => values.indexOf(value) === index).slice(0, 6),
      },
      methodology: {
        evaluatorVersion: EVALUATOR_VERSION,
        evaluatedAt: new Date().toISOString(),
        sources: [repoFullName ? "GitHub Repository API" : "Market metadata", packageName ? "Package registry metrics" : ""].filter(Boolean),
        scannedFiles: filePaths,
        scannedCharacters: security.scannedCharacters,
        aiJudgeUsed: Boolean(aiResult),
        aiJudgeModel: aiResult?.model,
        rubricVersion: aiResult?.rubricVersion,
        weights: WEIGHTS,
        limitations: [
          "静态评测不会安装或执行项目代码",
          "安全扫描基于高信号文件与已知模式，不能替代人工审计",
          "流行度只反映采用程度，不代表安全或工程质量",
        ],
        caseStudy: triggeredBy === "case-study",
      },
      overall,
    };

    const [evaluation] = await db.insert(evaluations).values({
      skillId: skill.id,
      overallScore: overall,
      documentationScore: documentation.score,
      securityScore: security.score,
      popularityScore,
      activityScore,
      qualityScore,
      report,
      evaluatedBy: `${triggeredBy}:v${EVALUATOR_VERSION}`,
    }).returning();
    if (!evaluation) throw new Error("评测报告写入失败");

    await db.update(skills).set({
      githubStars: popStats.stars,
      githubForks: popStats.forks,
      githubOpenIssues: repo?.open_issues_count ?? skill.githubOpenIssues,
      githubLastCommit: lastCommit,
      npmDownloadsWeekly: isNpm ? popStats.downloadsWeekly : skill.npmDownloadsWeekly,
      pypiDownloadsWeekly: isPypi ? popStats.downloadsWeekly : skill.pypiDownloadsWeekly,
      lastIndexedAt: new Date(),
    }).where(eq(skills.id, skill.id));

    await updateJob(job.id, { status: "done", stage: "done", progress: 100, finishedAt: new Date(), error: null });
    return evaluation.id;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "未知评测错误";
    const attempt = Math.max(1, job.attempt ?? 0);
    const canRetry = attempt < (job.maxAttempts ?? 3);
    await updateJob(job.id, {
      status: canRetry ? "pending" : "failed",
      stage: canRetry ? "retrying" : "failed",
      progress: 0,
      attempt,
      finishedAt: canRetry ? null : new Date(),
      startedAt: null,
      error: message,
    });
    throw error;
  }
}

async function recoverStaleJobs(): Promise<void> {
  const staleBefore = new Date(Date.now() - STALE_RUNNING_MINUTES * 60_000);
  await db.update(evaluationJobs).set({
    status: "failed",
    stage: "failed",
    finishedAt: new Date(),
    error: "Worker 超时且已达到最大重试次数",
  }).where(and(
    eq(evaluationJobs.status, "running"),
    lt(evaluationJobs.startedAt, staleBefore),
    gte(evaluationJobs.attempt, evaluationJobs.maxAttempts)
  ));
  await db.update(evaluationJobs).set({
    status: "pending",
    stage: "recovered",
    progress: 0,
    startedAt: null,
    error: "Worker 超时，任务已自动恢复",
  }).where(and(
    eq(evaluationJobs.status, "running"),
    lt(evaluationJobs.startedAt, staleBefore),
    lt(evaluationJobs.attempt, evaluationJobs.maxAttempts)
  ));
}

export async function processEvaluationQueue(batchSize = 5): Promise<number> {
  await recoverStaleJobs();
  const pending = await db.select().from(evaluationJobs)
    .where(eq(evaluationJobs.status, "pending"))
    .orderBy(asc(evaluationJobs.createdAt))
    .limit(Math.max(1, Math.min(batchSize, 20)));

  let processed = 0;
  for (const candidate of pending) {
    const [claimed] = await db.update(evaluationJobs).set({
      status: "running",
      stage: "metadata",
      progress: 5,
      startedAt: new Date(),
      attempt: sql`${evaluationJobs.attempt} + 1`,
      error: null,
    }).where(and(eq(evaluationJobs.id, candidate.id), eq(evaluationJobs.status, "pending"))).returning();
    if (!claimed) continue;
    try {
      await evaluateSkill({ skillId: claimed.skillId, jobId: claimed.id, triggeredBy: claimed.triggeredBy ?? "queue" });
      processed += 1;
    } catch (error) {
      console.error(`[evaluator] job ${claimed.id} failed:`, error);
    }
  }
  return processed;
}
