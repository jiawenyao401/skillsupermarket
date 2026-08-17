import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { evaluateSkill } from "../lib/evaluator";
import { getRepo } from "../lib/github";
import { evaluationJobs, evaluations, skills } from "../lib/schema";
import { slugify } from "../lib/utils";

const DEFAULT_CASES = [
  "microsoft/playwright-mcp",
  "modelcontextprotocol/servers",
  "anthropics/skills",
  "openai/skills",
];

function inferType(repo: { name: string; description: string | null; topics: string[] }) {
  const text = `${repo.name} ${repo.description ?? ""} ${repo.topics.join(" ")}`.toLowerCase();
  if (/\bmcp\b|model-context-protocol/.test(text)) return "mcp-server" as const;
  if (/claude[- ]skill|agent[- ]skill|skills/.test(text)) return "claude-skill" as const;
  return "agent-pack" as const;
}

function inferCategory(repo: { description: string | null; topics: string[] }) {
  const text = `${repo.description ?? ""} ${repo.topics.join(" ")}`.toLowerCase();
  if (/data|sql|database|analytics|etl/.test(text)) return "data";
  if (/design|ui|ux|image|figma/.test(text)) return "design";
  if (/doc|email|note|productivity|markdown/.test(text)) return "productivity";
  return "programming";
}

async function upsertCase(fullName: string): Promise<string> {
  const repo = await getRepo(fullName, true);
  if (!repo) throw new Error(`${fullName}: repository not found`);
  const slug = slugify(repo.full_name);
  const meta = {
    slug,
    name: repo.name,
    description: repo.description,
    repoUrl: repo.html_url,
    authorName: repo.owner.login,
    authorAvatar: repo.owner.avatar_url,
    authorUrl: repo.owner.html_url,
    license: repo.license?.spdx_id ?? null,
    githubStars: repo.stargazers_count,
    githubForks: repo.forks_count,
    githubOpenIssues: repo.open_issues_count,
    githubLastCommit: new Date(repo.pushed_at),
    type: inferType(repo),
    category: inferCategory(repo),
    tags: (repo.topics ?? []).map((tag) => tag.toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 8),
    source: "github" as const,
    status: "active" as const,
    lastUpdatedAt: new Date(),
    lastIndexedAt: new Date(),
  };

  const [existing] = await db.select().from(skills).where(eq(skills.slug, slug)).limit(1);
  if (existing) {
    await db.update(skills).set(meta).where(eq(skills.id, existing.id));
    return existing.id;
  }
  const [created] = await db.insert(skills).values(meta).returning();
  if (!created) throw new Error(`${fullName}: failed to create skill`);
  return created.id;
}

async function evaluateCase(fullName: string) {
  const skillId = await upsertCase(fullName);
  const [activeJob] = await db.select().from(evaluationJobs).where(and(
    eq(evaluationJobs.skillId, skillId),
    inArray(evaluationJobs.status, ["pending", "running"])
  )).limit(1);
  if (activeJob) throw new Error(`${fullName}: active evaluation job ${activeJob.id}`);

  const evaluationId = await evaluateSkill({
    skillId,
    triggeredBy: "case-study",
    requireAIJudge: true,
  });
  const [evaluation] = await db.select().from(evaluations)
    .where(eq(evaluations.id, evaluationId))
    .orderBy(desc(evaluations.evaluatedAt))
    .limit(1);
  if (!evaluation) throw new Error(`${fullName}: evaluation not found after completion`);
  const report = evaluation.report as { quality?: { aiScore?: number | null; llmComment?: string }; summary?: { verdictLabel?: string } };
  return {
    repository: fullName,
    slug: slugify(fullName),
    evaluationId,
    overall: evaluation.overallScore,
    documentation: evaluation.documentationScore,
    security: evaluation.securityScore,
    popularity: evaluation.popularityScore,
    activity: evaluation.activityScore,
    quality: evaluation.qualityScore,
    aiScore: report.quality?.aiScore ?? null,
    verdict: report.summary?.verdictLabel ?? null,
    comment: report.quality?.llmComment ?? null,
  };
}

async function main() {
  const repositories = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_CASES;
  for (const repository of repositories) {
    try {
      console.log(JSON.stringify(await evaluateCase(repository)));
    } catch (error) {
      console.error(JSON.stringify({ repository, error: error instanceof Error ? error.message : String(error) }));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
