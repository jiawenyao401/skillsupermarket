import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { evaluations, evaluationJobs, metricsDaily, skillReadmes, skills } from "./schema";
import { evaluate } from "../packages/evaluation-sdk/src/index";
import { inferDocumentKind } from "../packages/evaluation-sdk/src/input";
import { hasJudgeConfiguration, judgeSkill } from "./judge";
import { EVALUATOR_VERSION } from "./evaluation-scoring";
import { getEvaluationFiles, getReadmeDocument, getRepo } from "./github";
import { getNpmWeeklyDownloads } from "./npm";
import { getPypiWeeklyDownloads } from "./pypi";
import { EVALUATION_QUEUE_PRIORITY, SCHEDULED_COVERAGE_TRIGGER } from "./evaluation-queue-policy";
import { inferGitHubSkillType, SKILL_CLASSIFIER_VERSION } from "./skill-classification";
import { readmeCacheValues } from "./readme-cache";
import type {
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
    const [repo, readmeDocument] = await Promise.all([
      repoFullName ? getRepo(repoFullName) : Promise.resolve(null),
      repoFullName ? getReadmeDocument(repoFullName) : Promise.resolve(null),
    ]);
    const extraFiles = repoFullName ? await getEvaluationFiles(repoFullName, repo?.default_branch) : [];
    readme = readmeDocument?.content ?? skill.description ?? "";
    const evaluationType = repo && skill.source === "github"
      ? inferGitHubSkillType(repo)
      : skill.type;

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
    const lastCommit = repo?.pushed_at ? new Date(repo.pushed_at) : skill.githubLastCommit;
    const { report, diagnostics } = await evaluate({
      name: skill.name,
      type: evaluationType,
      description: skill.description,
      readme,
      files: extraFiles.filter((file) => file.path.toLowerCase() !== "readme.md")
        .map((file) => ({ path: file.path, content: file.content, kind: inferDocumentKind(file.path) })),
      hasLicense: Boolean(skill.license ?? repo?.license),
      hasRepository: Boolean(repoFullName),
      hasRepositoryMetadata: Boolean(repo),
      popularity: popStats,
      lastCommitAt: lastCommit?.toISOString() ?? null,
      openIssues: repo?.open_issues_count ?? skill.githubOpenIssues ?? 0,
      sources: [repoFullName ? "GitHub Repository API" : "Market metadata", packageName ? "Package registry metrics" : ""].filter(Boolean),
      classifierVersion: skill.source === "github" ? SKILL_CLASSIFIER_VERSION : undefined,
      caseStudy: triggeredBy === "case-study",
    }, {
      judge: hasJudgeConfiguration() ? judgeSkill : undefined,
      aiPolicy: options.requireAIJudge ? "required" : "optional",
      onStage: (stage) => updateJob(job.id, { stage, progress: { security: 40, quality: 66, report: 88 }[stage] }),
    });
    if (diagnostics.aiStatus === "failed") {
      console.error("[evaluator] AI judge failed:", diagnostics.aiErrorCode);
    }

    const [evaluation] = await db.insert(evaluations).values({
      skillId: skill.id,
      overallScore: report.overall,
      documentationScore: report.documentation.score,
      securityScore: report.security.score,
      popularityScore: report.popularity.score,
      activityScore: report.activity.score,
      qualityScore: report.quality.score,
      report,
      evaluatedBy: `${triggeredBy}:v${EVALUATOR_VERSION}`,
    }).returning();
    if (!evaluation) throw new Error("评测报告写入失败");

    await db.update(skills).set({
      type: evaluationType,
      githubStars: popStats.stars,
      githubForks: popStats.forks,
      githubOpenIssues: repo?.open_issues_count ?? skill.githubOpenIssues,
      githubLastCommit: lastCommit,
      npmDownloadsWeekly: isNpm ? popStats.downloadsWeekly : skill.npmDownloadsWeekly,
      pypiDownloadsWeekly: isPypi ? popStats.downloadsWeekly : skill.pypiDownloadsWeekly,
      lastIndexedAt: new Date(),
    }).where(eq(skills.id, skill.id));
    if (repoFullName && readmeDocument) {
      const values = readmeCacheValues(readmeDocument);
      await db.insert(skillReadmes).values({ skillId: skill.id, ...values }).onConflictDoUpdate({
        target: skillReadmes.skillId,
        set: values,
      });
    }

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
  const limit = Math.max(1, Math.min(batchSize, 20));
  let processed = 0;
  for (let index = 0; index < limit; index += 1) {
    // Re-select before every claim so a user submission that arrives while a
    // background evaluation is running moves ahead of the remaining batch.
    const [candidate] = await db.select().from(evaluationJobs)
      .where(eq(evaluationJobs.status, "pending"))
      .orderBy(
        sql<number>`case
          when ${evaluationJobs.userId} is not null and ${evaluationJobs.triggeredBy} = 'authenticated-user'
            then ${EVALUATION_QUEUE_PRIORITY.authenticatedUser}
          when ${evaluationJobs.userId} is not null then ${EVALUATION_QUEUE_PRIORITY.attributedUser}
          when ${evaluationJobs.triggeredBy} = 'case-study' then ${EVALUATION_QUEUE_PRIORITY.caseStudy}
          when ${evaluationJobs.triggeredBy} = ${SCHEDULED_COVERAGE_TRIGGER}
            then ${EVALUATION_QUEUE_PRIORITY.scheduledCoverage}
          else ${EVALUATION_QUEUE_PRIORITY.operations}
        end`,
        asc(evaluationJobs.createdAt),
      )
      .limit(1);
    if (!candidate) break;
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
