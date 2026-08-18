import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { evaluationJobs, evaluations } from "@/lib/schema";
import { getRepo } from "@/lib/github";
import { getNpmPackage } from "@/lib/npm";
import { getPypiPackage } from "@/lib/pypi";
import { extractGithubUrl, parseEvaluationSource } from "@/lib/source-parser";
import { UpstreamServiceError } from "@/lib/upstream-error";
import { getRequestSession, unauthorizedResponse } from "@/lib/auth-session";
import {
  findSkillByEvaluationSource,
  SourceIdentityConflictError,
  upsertSkillByEvaluationSource,
} from "@/lib/skill-upsert";
import {
  ActiveEvaluationRaceError,
  getEvaluationNetworkKey,
  QuotaExceededError,
  reserveQuotaAndCreateJob,
} from "@/lib/quota";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const submitSchema = z.object({
  url: z.string().trim().min(1).max(500),
});

interface RateBucket { count: number; resetAt: number; }
const MAX_RATE_LIMIT_BUCKETS = 10_000;
const globalForRateLimit = globalThis as unknown as {
  evaluationRateLimits?: Map<string, RateBucket>;
  evaluationRateLimitLastSweep?: number;
};
const rateLimits = globalForRateLimit.evaluationRateLimits ?? new Map<string, RateBucket>();
globalForRateLimit.evaluationRateLimits = rateLimits;

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  // Nginx overwrites X-Real-IP with $remote_addr. X-Forwarded-For can contain
  // client-supplied values, so it is only a fallback for non-Nginx runtimes.
  const ip = request.headers.get("x-real-ip") || forwarded || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

function checkRateLimit(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  if (now - (globalForRateLimit.evaluationRateLimitLastSweep ?? 0) >= 60_000) {
    for (const [bucketKey, bucket] of rateLimits) {
      if (bucket.resetAt <= now) rateLimits.delete(bucketKey);
    }
    globalForRateLimit.evaluationRateLimitLastSweep = now;
  }
  if (rateLimits.size >= MAX_RATE_LIMIT_BUCKETS && !rateLimits.has(key)) {
    return { allowed: false, retryAfter: 60 };
  }
  const bucket = rateLimits.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + 60 * 60_000 });
    return { allowed: true, retryAfter: 0 };
  }
  if (bucket.count >= 5) return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function inferType(repo: { name: string; description: string | null; topics: string[] }): "claude-skill" | "mcp-server" | "agent-pack" {
  const text = `${repo.name} ${repo.description ?? ""} ${repo.topics.join(" ")}`.toLowerCase();
  if (text.includes("mcp") || text.includes("model-context-protocol")) return "mcp-server";
  if (text.includes("claude-skill") || text.includes("claude skill") || text.includes("skill.md")) return "claude-skill";
  return "agent-pack";
}

function inferCategory(repo: { description: string | null; topics: string[] }): string {
  const text = `${repo.description ?? ""} ${repo.topics.join(" ")}`.toLowerCase();
  if (/data|sql|database|analytics|etl/.test(text)) return "data";
  if (/design|ui|ux|image|figma/.test(text)) return "design";
  if (/doc|email|note|productivity|markdown/.test(text)) return "productivity";
  return "programming";
}

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return unauthorizedResponse();

  const rateLimit = checkRateLimit(`${session.user.id}:${getClientKey(request)}`);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "提交过于频繁，请稍后再试", code: "RATE_LIMITED", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  try {
    if (Number(request.headers.get("content-length") ?? 0) > 4096) {
      return NextResponse.json({ error: "请求内容过大", code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }
    const parsedBody = submitSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json({ error: "请输入有效的仓库或包地址", code: "INVALID_INPUT" }, { status: 400 });
    }
    const source = parseEvaluationSource(parsedBody.data.url);
    if (!source) {
      return NextResponse.json({
        error: "仅支持 GitHub、npm 与 PyPI 的公开项目；PyPI 包名请使用 pypi:包名",
        code: "UNSUPPORTED_SOURCE",
      }, { status: 400 });
    }

    // Fast path: a fresh local report or active job must remain available even
    // when GitHub/npm/PyPI is temporarily rate-limited or unavailable.
    const knownSkill = await findSkillByEvaluationSource(source);
    if (knownSkill) {
      const [knownActiveJob] = await db.select().from(evaluationJobs).where(and(
        eq(evaluationJobs.skillId, knownSkill.id),
        inArray(evaluationJobs.status, ["pending", "running"])
      )).orderBy(desc(evaluationJobs.createdAt)).limit(1);
      if (knownActiveJob) {
        if (knownActiveJob.userId && knownActiveJob.userId !== session.user.id) {
          return NextResponse.json({
            error: "该项目正在评测中，请稍后查看公开报告",
            code: "EVALUATION_IN_PROGRESS",
          }, { status: 409 });
        }
        return NextResponse.json({
          ok: true, duplicate: true, slug: knownSkill.slug, skillId: knownSkill.id,
          jobId: knownActiveJob.id, status: knownActiveJob.status,
          stage: knownActiveJob.stage, progress: knownActiveJob.progress,
          message: "该项目已在评测队列中",
        });
      }
      const [knownEvaluation] = await db.select().from(evaluations)
        .where(eq(evaluations.skillId, knownSkill.id))
        .orderBy(desc(evaluations.evaluatedAt)).limit(1);
      const knownVersion = (knownEvaluation?.report as { version?: string } | undefined)?.version;
      const knownIsFresh = knownVersion === "3.0.0" && knownEvaluation?.evaluatedAt &&
        Date.now() - knownEvaluation.evaluatedAt.getTime() < 24 * 60 * 60_000;
      if (knownIsFresh) {
        return NextResponse.json({
          ok: true, cached: true, slug: knownSkill.slug, skillId: knownSkill.id,
          evaluationId: knownEvaluation.id, status: "done", progress: 100,
          message: "已返回 24 小时内的最新评测",
        });
      }
    }

    let meta: {
      name: string;
      description: string | null;
      repoUrl: string | null;
      packageUrl: string | null;
      authorName: string | null;
      authorAvatar: string | null;
      authorUrl: string | null;
      license: string | null;
      currentVersion: string | null;
      githubStars: number;
      githubForks: number;
      githubOpenIssues: number;
      githubLastCommit: Date | null;
      type: "claude-skill" | "mcp-server" | "agent-pack";
      category: string;
      tags: string[];
    };
    let canonicalSource = source;

    if (source.kind === "github") {
      const repo = await getRepo(source.fullName, true);
      if (!repo) return NextResponse.json({ error: "GitHub 仓库不存在、不可公开访问或上游暂时不可用", code: "SOURCE_NOT_FOUND" }, { status: 404 });
      canonicalSource = { kind: "github", fullName: repo.full_name };
      meta = {
        name: repo.name,
        description: repo.description,
        repoUrl: repo.html_url,
        packageUrl: null,
        authorName: repo.owner.login,
        authorAvatar: repo.owner.avatar_url,
        authorUrl: repo.owner.html_url,
        license: repo.license?.spdx_id ?? null,
        currentVersion: null,
        githubStars: repo.stargazers_count,
        githubForks: repo.forks_count,
        githubOpenIssues: repo.open_issues_count,
        githubLastCommit: new Date(repo.pushed_at),
        type: inferType(repo),
        category: inferCategory(repo),
        tags: (repo.topics ?? []).map((tag) => tag.toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 8),
      };
    } else if (source.kind === "npm") {
      const pkg = await getNpmPackage(source.name, true);
      if (!pkg) return NextResponse.json({ error: "npm 包不存在或上游暂时不可用", code: "SOURCE_NOT_FOUND" }, { status: 404 });
      canonicalSource = { kind: "npm", name: pkg.name };
      meta = {
        name: pkg.name, description: pkg.description ?? null,
        repoUrl: extractGithubUrl(pkg.repository?.url), packageUrl: `https://www.npmjs.com/package/${pkg.name}`,
        authorName: pkg.maintainers?.[0]?.name ?? null, authorAvatar: null, authorUrl: null,
        license: pkg.license ?? null, currentVersion: pkg.version,
        githubStars: 0, githubForks: 0, githubOpenIssues: 0, githubLastCommit: null,
        type: pkg.name.startsWith("@modelcontextprotocol/") || /\bmcp\b/i.test(`${pkg.name} ${pkg.description ?? ""}`) ? "mcp-server" : "agent-pack",
        category: "programming",
        tags: (pkg.keywords ?? []).map((tag) => tag.toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 8),
      };
    } else {
      const pkg = await getPypiPackage(source.name, true);
      if (!pkg) return NextResponse.json({ error: "PyPI 包不存在或上游暂时不可用", code: "SOURCE_NOT_FOUND" }, { status: 404 });
      canonicalSource = { kind: "pypi", name: pkg.name };
      meta = {
        name: pkg.name, description: pkg.summary ?? null,
        repoUrl: extractGithubUrl(pkg.home_page ?? pkg.project_url), packageUrl: `https://pypi.org/project/${pkg.name}/`,
        authorName: pkg.author ?? null, authorAvatar: null, authorUrl: null,
        license: pkg.license ?? null, currentVersion: pkg.version,
        githubStars: 0, githubForks: 0, githubOpenIssues: 0, githubLastCommit: null,
        type: /\bmcp\b/i.test(`${pkg.name} ${pkg.summary ?? ""}`) ? "mcp-server" : "agent-pack",
        category: "programming",
        tags: (pkg.keywords?.split(/[ ,]+/) ?? []).map((tag) => tag.toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 8),
      };
    }

    const persistedSkill = await upsertSkillByEvaluationSource(canonicalSource, {
      ...meta,
      lastUpdatedAt: new Date(),
      lastIndexedAt: new Date(),
      status: "active",
    });
    const skillId = persistedSkill.id;

    const [activeJob] = await db.select().from(evaluationJobs).where(and(
      eq(evaluationJobs.skillId, skillId),
      inArray(evaluationJobs.status, ["pending", "running"])
    )).orderBy(desc(evaluationJobs.createdAt)).limit(1);
    if (activeJob) {
      if (activeJob.userId && activeJob.userId !== session.user.id) {
        return NextResponse.json({
          error: "该项目正在评测中，请稍后查看公开报告",
          code: "EVALUATION_IN_PROGRESS",
        }, { status: 409 });
      }
      return NextResponse.json({
        ok: true,
        duplicate: true,
        slug: persistedSkill.slug,
        skillId,
        jobId: activeJob.id,
        status: activeJob.status,
        stage: activeJob.stage,
        progress: activeJob.progress,
        message: "该项目已在评测队列中",
      });
    }

    const [latestEvaluation] = await db.select().from(evaluations).where(eq(evaluations.skillId, skillId)).orderBy(desc(evaluations.evaluatedAt)).limit(1);
    const reportVersion = (latestEvaluation?.report as { version?: string } | undefined)?.version;
    const isFresh = reportVersion === "3.0.0" && latestEvaluation?.evaluatedAt && Date.now() - latestEvaluation.evaluatedAt.getTime() < 24 * 60 * 60_000;
    if (isFresh) {
      return NextResponse.json({
        ok: true,
        cached: true,
        slug: persistedSkill.slug,
        skillId,
        evaluationId: latestEvaluation.id,
        status: "done",
        progress: 100,
        message: "已返回 24 小时内的最新评测",
      });
    }

    let reservation: Awaited<ReturnType<typeof reserveQuotaAndCreateJob>>;
    try {
      reservation = await reserveQuotaAndCreateJob({
        userId: session.user.id,
        networkKey: getEvaluationNetworkKey(request),
        skillId,
      });
    } catch (error) {
      if (!(error instanceof ActiveEvaluationRaceError)) throw error;
      const [job] = await db.select().from(evaluationJobs).where(and(
        eq(evaluationJobs.skillId, skillId),
        inArray(evaluationJobs.status, ["pending", "running"])
      )).orderBy(desc(evaluationJobs.createdAt)).limit(1);
      if (!job) throw new Error("评测任务创建失败");
      if (job.userId && job.userId !== session.user.id) {
        return NextResponse.json({
          error: "该项目正在评测中，请稍后查看公开报告",
          code: "EVALUATION_IN_PROGRESS",
        }, { status: 409 });
      }
      return NextResponse.json({
        ok: true,
        duplicate: true,
        slug: persistedSkill.slug,
        skillId,
        jobId: job.id,
        status: job.status,
        stage: job.stage,
        progress: job.progress,
        message: "该项目已在评测队列中",
      });
    }

    const { job, quota } = reservation;

    return NextResponse.json({
      ok: true,
      slug: persistedSkill.slug,
      skillId,
      jobId: job.id,
      status: "pending",
      stage: "queued",
      progress: 0,
      quota,
      message: "评测已开始，页面会实时更新进度",
    }, { status: 202 });
  } catch (error) {
    console.error("[api/evaluate] error:", error);
    if (error instanceof QuotaExceededError) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        quota: error.quota,
      }, { status: 402, headers: { "Cache-Control": "no-store" } });
    }
    if (error instanceof UpstreamServiceError) {
      return NextResponse.json({
        error: `${error.service.toUpperCase()} 上游暂时不可用，请稍后重试`,
        code: "UPSTREAM_UNAVAILABLE",
      }, { status: 503, headers: { "Retry-After": "60" } });
    }
    if (error instanceof SourceIdentityConflictError) {
      return NextResponse.json({
        error: "该项目的公开标识与已有来源冲突，请联系管理员核验",
        code: "SOURCE_IDENTITY_CONFLICT",
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    const message = error instanceof SyntaxError ? "请求格式不正确" : "提交失败，请稍后重试";
    const status = error instanceof SyntaxError ? 400 : 500;
    const code = error instanceof SyntaxError ? "INVALID_JSON" : "INTERNAL_ERROR";
    return NextResponse.json({ error: message, code }, { status });
  }
}
