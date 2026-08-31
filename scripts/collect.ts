// 采集脚本: 从 GitHub / npm / PyPI 抓 skill 元数据
// 运行: npm run collect
import { db } from "../lib/db";
import { metricsDaily } from "../lib/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import { searchSkills, type GitHubRepo } from "../lib/github";
import { getNpmPackage, getNpmWeeklyDownloads, searchNpmMcpPackages } from "../lib/npm";
import { rankingDateKey } from "../lib/ranker";
import { upsertSkillByEvaluationSource } from "../lib/skill-upsert";
import { inferGitHubSkillType } from "../lib/skill-classification";

const log = (...args: unknown[]) => console.log("[collect]", ...args);

function inferCategory(repo: GitHubRepo): string {
  const text = `${repo.description ?? ""} ${repo.topics.join(" ")}`.toLowerCase();
  if (/data|sql|database|analytics|etl/.test(text)) return "data";
  if (/design|ui|ux|image|figma/.test(text)) return "design";
  if (/doc|email|note|productivity|markdown/.test(text)) return "productivity";
  return "programming";
}

// 抓 GitHub 仓库
async function collectFromGitHub(): Promise<number> {
  log("开始 GitHub 采集...");
  const repos = await searchSkills(30);
  log(`找到 ${repos.length} 个候选`);
  const minimumCandidates = Math.max(1, Number(process.env.MIN_GITHUB_CANDIDATES) || 30);
  if (repos.length < minimumCandidates) {
    throw new Error(`GitHub 采集结果异常：仅 ${repos.length} 个，低于安全阈值 ${minimumCandidates}`);
  }

  let count = 0;
  for (const repo of repos) {
    const type = inferGitHubSkillType(repo);
    const category = inferCategory(repo);
    const skill = await upsertSkillByEvaluationSource(
      { kind: "github", fullName: repo.full_name },
      {
        type,
        name: repo.name,
        description: repo.description,
        tags: (repo.topics ?? []).slice(0, 8),
        category,
        repoUrl: repo.html_url,
        packageUrl: null,
        authorName: repo.owner.login,
        authorAvatar: repo.owner.avatar_url,
        authorUrl: repo.owner.html_url,
        license: repo.license?.spdx_id ?? null,
        currentVersion: null,
        githubStars: repo.stargazers_count,
        githubForks: repo.forks_count,
        githubWatchers: repo.watchers_count,
        githubOpenIssues: repo.open_issues_count,
        githubLastCommit: new Date(repo.pushed_at),
        lastUpdatedAt: new Date(),
        lastIndexedAt: new Date(),
        status: "active",
      },
    );

    // 写每日指标
    const today = rankingDateKey();
    if (skill) {
      const [prevMetric] = await db
        .select()
        .from(metricsDaily)
        .where(and(eq(metricsDaily.skillId, skill.id), lt(metricsDaily.date, today)))
        .orderBy(sql`${metricsDaily.date} DESC`)
        .limit(1);
      const prevStars = prevMetric?.githubStars ?? repo.stargazers_count;
      const delta = repo.stargazers_count - prevStars;

      await db
        .insert(metricsDaily)
        .values({
          skillId: skill.id,
          date: today,
          githubStars: repo.stargazers_count,
          githubStarsDelta: delta,
          githubForks: repo.forks_count,
          githubOpenIssues: repo.open_issues_count,
        })
        .onConflictDoUpdate({
          target: [metricsDaily.skillId, metricsDaily.date],
          set: {
            githubStars: repo.stargazers_count,
            githubStarsDelta: delta,
            githubForks: repo.forks_count,
            githubOpenIssues: repo.open_issues_count,
          },
        });
    }

    count++;
    await new Promise((r) => setTimeout(r, 300)); // 节流
  }
  log(`✅ GitHub 采集完成: ${count} 个`);
  return count;
}

// 抓 npm MCP 包
async function collectFromNpm(): Promise<number> {
  log("开始 npm 采集...");
  const candidates = await searchNpmMcpPackages();
  log(`找到 ${candidates.length} 个 MCP 包`);

  let count = 0;
  for (const name of candidates) {
    const pkg = await getNpmPackage(name);
    if (!pkg) continue;

    const downloads = await getNpmWeeklyDownloads(name);
    const repoUrl = extractGithubFromNpm(pkg.repository?.url);
    const skill = await upsertSkillByEvaluationSource(
      { kind: "npm", name: pkg.name },
      {
        type: "mcp-server",
        name: pkg.name,
        description: pkg.description ?? null,
        tags: (pkg.keywords ?? []).slice(0, 8),
        category: "programming",
        repoUrl,
        packageUrl: `https://www.npmjs.com/package/${pkg.name}`,
        authorName: pkg.maintainers?.[0]?.name ?? null,
        authorAvatar: null,
        authorUrl: null,
        license: pkg.license ?? null,
        currentVersion: pkg.version,
        npmDownloadsWeekly: downloads,
        lastUpdatedAt: new Date(),
        lastIndexedAt: new Date(),
        status: "active",
      },
    );

    const today = rankingDateKey();
    if (skill) {
      await db.insert(metricsDaily).values({
        skillId: skill.id,
        date: today,
        githubStars: skill.githubStars ?? 0,
        githubForks: skill.githubForks ?? 0,
        githubOpenIssues: skill.githubOpenIssues ?? 0,
        npmDownloadsWeekly: downloads,
      }).onConflictDoUpdate({
        target: [metricsDaily.skillId, metricsDaily.date],
        set: { npmDownloadsWeekly: downloads },
      });
    }

    count++;
    await new Promise((r) => setTimeout(r, 200));
  }
  log(`✅ npm 采集完成: ${count} 个`);
  return count;
}

function extractGithubFromNpm(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
  return m ? `https://github.com/${m[1]}` : null;
}

async function main() {
  log("=== Skill Supermarket 采集任务 ===");
  const start = Date.now();

  const ghCount = await collectFromGitHub();
  const npmCount = await collectFromNpm();

  const total = ghCount + npmCount;
  const seconds = ((Date.now() - start) / 1000).toFixed(1);

  log(`=== 完成: 共 ${total} 个 skill (GitHub: ${ghCount}, npm: ${npmCount}), 用时 ${seconds}s ===`);
  log("采集指标已写入，流水线将继续生成榜单");
  process.exit(0);
}

main().catch((err) => {
  console.error("[collect] 致命错误:", err);
  process.exit(1);
});
