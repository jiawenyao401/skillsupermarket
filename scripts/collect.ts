// 采集脚本: 从 GitHub / npm / PyPI 抓 skill 元数据
// 运行: npm run collect
import { db } from "../lib/db";
import { skills, metricsDaily } from "../lib/schema";
import { eq, sql } from "drizzle-orm";
import { searchSkills, getRepo, type GitHubRepo } from "../lib/github";
import { getNpmPackage, getNpmWeeklyDownloads, searchNpmMcpPackages } from "../lib/npm";
import { getPypiPackage } from "../lib/pypi";
import { slugify } from "../lib/utils";

const log = (...args: unknown[]) => console.log("[collect]", ...args);

// 推断 type 和 category
function inferType(repo: GitHubRepo): "claude-skill" | "mcp-server" | "agent-pack" {
  const text = `${repo.name} ${repo.description ?? ""} ${repo.topics.join(" ")}`.toLowerCase();
  if (text.includes("mcp") || text.includes("model-context-protocol")) return "mcp-server";
  if (text.includes("claude-skill") || text.includes("claude skill")) return "claude-skill";
  return "agent-pack";
}

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

  let count = 0;
  for (const repo of repos) {
    const slug = slugify(repo.full_name);
    const type = inferType(repo);
    const category = inferCategory(repo);

    const existing = await db.select().from(skills).where(eq(skills.slug, slug));

    if (existing.length > 0) {
      // 更新
      await db
        .update(skills)
        .set({
          name: repo.name,
          description: repo.description,
          tags: (repo.topics ?? []).slice(0, 8),
          category,
          githubStars: repo.stargazers_count,
          githubForks: repo.forks_count,
          githubWatchers: repo.watchers_count,
          githubOpenIssues: repo.open_issues_count,
          githubLastCommit: new Date(repo.pushed_at),
          license: repo.license?.spdx_id ?? null,
          lastUpdatedAt: new Date(),
          lastIndexedAt: new Date(),
        })
        .where(eq(skills.slug, slug));
    } else {
      // 新增
      await db.insert(skills).values({
        slug,
        type,
        name: repo.name,
        description: repo.description,
        tags: (repo.topics ?? []).slice(0, 8),
        category,
        source: "github",
        repoUrl: repo.html_url,
        authorName: repo.owner.login,
        authorAvatar: repo.owner.avatar_url,
        authorUrl: repo.owner.html_url,
        license: repo.license?.spdx_id ?? null,
        githubStars: repo.stargazers_count,
        githubForks: repo.forks_count,
        githubWatchers: repo.watchers_count,
        githubOpenIssues: repo.open_issues_count,
        githubLastCommit: new Date(repo.pushed_at),
      });
    }

    // 写每日指标
    const today = new Date().toISOString().split("T")[0];
    const skill = await db.select().from(skills).where(eq(skills.slug, slug));
    if (skill[0]) {
      const [prevMetric] = await db
        .select()
        .from(metricsDaily)
        .where(eq(metricsDaily.skillId, skill[0].id))
        .orderBy(sql`${metricsDaily.date} DESC`)
        .limit(1);
      const prevStars = prevMetric?.githubStars ?? repo.stargazers_count;
      const delta = repo.stargazers_count - prevStars;

      await db
        .insert(metricsDaily)
        .values({
          skillId: skill[0].id,
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
    const slug = slugify(pkg.name);

    const existing = await db.select().from(skills).where(eq(skills.slug, slug));
    const repoUrl = extractGithubFromNpm(pkg.repository?.url);

    if (existing.length > 0) {
      await db
        .update(skills)
        .set({
          description: pkg.description ?? null,
          license: pkg.license ?? null,
          currentVersion: pkg.version,
          npmDownloadsWeekly: downloads,
          lastUpdatedAt: new Date(),
          lastIndexedAt: new Date(),
        })
        .where(eq(skills.slug, slug));
    } else {
      await db.insert(skills).values({
        slug,
        type: "mcp-server",
        name: pkg.name,
        description: pkg.description ?? null,
        tags: (pkg.keywords ?? []).slice(0, 8),
        category: "programming",
        source: "npm",
        repoUrl,
        packageUrl: `https://www.npmjs.com/package/${pkg.name}`,
        authorName: pkg.maintainers?.[0]?.name ?? null,
        license: pkg.license ?? null,
        currentVersion: pkg.version,
        npmDownloadsWeekly: downloads,
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
  log("下一步: npm run evaluate  // 跑评测");
  log("       npm run rank      // 生成榜单");
  process.exit(0);
}

main().catch((err) => {
  console.error("[collect] 致命错误:", err);
  process.exit(1);
});
