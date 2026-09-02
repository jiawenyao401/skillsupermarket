import "dotenv/config";
import { SITE_URL } from "../lib/site";

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

interface ResponseSnapshot {
  status: number;
  body: string;
  headers: Headers;
}

async function request(path: string, init?: RequestInit): Promise<ResponseSnapshot> {
  const response = await fetch(new URL(path, `${SITE_URL}/`), {
    headers: { "User-Agent": "SkillSupermarketSEOHealth/1.0" },
    redirect: init?.redirect ?? "follow",
    signal: AbortSignal.timeout(12_000),
    ...init,
  });
  return { status: response.status, body: await response.text(), headers: response.headers };
}

function recordFromJson(body: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(body);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function protectedRedirect(result: ResponseSnapshot, returnTo: string): boolean {
  if (![307, 308].includes(result.status)) return false;
  const location = result.headers.get("location");
  if (!location) return false;
  const destination = new URL(location, SITE_URL);
  return destination.pathname === "/login" && destination.searchParams.get("returnTo") === returnTo;
}

async function main() {
  const checks: CheckResult[] = [];
  const caseSlug = process.env.SEO_CASE_SLUG?.trim() || "githubgithub-mcp-server";
  const protectedPaths = ["/evaluate", "/account", "/admin"] as const;
  const [
    health,
    home,
    evaluation,
    mcpSecurityScan,
    guides,
    guide,
    claudeCodeGuide,
    privacy,
    login,
    robots,
    sitemap,
    caseApi,
    casePage,
    anonymousEvaluation,
    ...protectedPages
  ] = await Promise.all([
    request("/api/health"),
    request("/"),
    request("/evaluation"),
    request("/mcp-server-security-scan"),
    request("/guides"),
    request("/guides/mcp-server-security-checklist-2026"),
    request("/guides/claude-code-skills-recommended-2026"),
    request("/privacy"),
    request("/login?returnTo=%2Fevaluate"),
    request("/robots.txt"),
    request("/sitemap.xml"),
    request(`/api/skills?slug=${encodeURIComponent(caseSlug)}`),
    request(`/skill/${encodeURIComponent(caseSlug)}`),
    request("/api/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "SkillSupermarketSEOHealth/1.0",
      },
      body: JSON.stringify({ url: "https://github.com/github/github-mcp-server" }),
      redirect: "manual",
    }),
    ...protectedPaths.map((path) => request(path, { redirect: "manual" })),
  ]);

  const healthData = recordFromJson(health.body);
  checks.push({
    name: "应用、数据库与 Judge 健康",
    ok: health.status === 200
      && healthData?.ok === true
      && healthData.database === "ready"
      && healthData.judge === "ready",
    detail: `HTTP ${health.status} · database=${String(healthData?.database ?? "unknown")} · judge=${String(healthData?.judge ?? "unknown")}`,
  });

  checks.push({ name: "首页可访问", ok: home.status === 200, detail: `HTTP ${home.status}` });
  checks.push({
    name: "首页 Canonical",
    ok: /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/skillsupermarket\.com\/?["']/i.test(home.body)
      || /<link[^>]+href=["']https:\/\/skillsupermarket\.com\/?["'][^>]+rel=["']canonical["']/i.test(home.body),
    detail: "应指向 https://skillsupermarket.com/",
  });
  checks.push({ name: "首页结构化数据", ok: home.body.includes("application/ld+json"), detail: "Organization + WebSite" });
  checks.push({
    name: "评测落地页",
    ok: evaluation.status === 200 && evaluation.body.includes("Evidence-based evaluation"),
    detail: `HTTP ${evaluation.status}`,
  });
  checks.push({
    name: "评测页 Canonical",
    ok: evaluation.body.includes(`${SITE_URL}/evaluation`) && evaluation.body.includes("canonical"),
    detail: `${SITE_URL}/evaluation`,
  });
  checks.push({
    name: "评测页结构化数据",
    ok: evaluation.body.includes("application/ld+json") && evaluation.body.includes("Service"),
    detail: "Service + FAQPage",
  });
  checks.push({
    name: "MCP 安全扫描落地页",
    ok: mcpSecurityScan.status === 200
      && mcpSecurityScan.body.includes("MCP security evaluator")
      && mcpSecurityScan.body.includes(`${SITE_URL}/mcp-server-security-scan`)
      && mcpSecurityScan.body.includes("FAQPage")
      && mcpSecurityScan.body.includes("Service"),
    detail: `HTTP ${mcpSecurityScan.status} · Service + FAQPage + canonical`,
  });
  checks.push({
    name: "高意图指南入口",
    ok: guides.status === 200 && guides.body.includes("Builder guides") && guides.body.includes("CollectionPage"),
    detail: `HTTP ${guides.status}`,
  });
  checks.push({
    name: "MCP 安全指南",
    ok: guide.status === 200
      && guide.body.includes("2026-07-28")
      && guide.body.includes("application/ld+json")
      && guide.body.includes(`${SITE_URL}/guides/mcp-server-security-checklist-2026`),
    detail: `HTTP ${guide.status} · Article + canonical`,
  });
  checks.push({
    name: "Claude Code Skill 推荐指南",
    ok: claudeCodeGuide.status === 200
      && claudeCodeGuide.body.includes("Claude Code Skill 推荐 2026")
      && claudeCodeGuide.body.includes("application/ld+json")
      && claudeCodeGuide.body.includes(`${SITE_URL}/guides/claude-code-skills-recommended-2026`),
    detail: `HTTP ${claudeCodeGuide.status} · Article + canonical`,
  });
  checks.push({ name: "隐私说明", ok: privacy.status === 200 && privacy.body.includes("Global Privacy Control"), detail: `HTTP ${privacy.status}` });
  checks.push({
    name: "登录页",
    ok: login.status === 200 && login.body.includes("登录"),
    detail: `HTTP ${login.status}`,
  });
  checks.push({ name: "Robots", ok: robots.status === 200 && robots.body.includes("Sitemap:"), detail: `HTTP ${robots.status}` });
  checks.push({
    name: "Sitemap",
    ok: sitemap.status === 200
      && sitemap.body.includes("<urlset")
      && sitemap.body.includes("/skill/")
      && sitemap.body.includes("/evaluation")
      && sitemap.body.includes("/mcp-server-security-scan")
      && sitemap.body.includes("/guides/claude-code-skills-recommended-2026")
      && sitemap.body.includes("/guides/mcp-server-security-checklist-2026"),
    detail: `HTTP ${sitemap.status} · ${(sitemap.body.match(/<loc>/g) ?? []).length} URLs`,
  });

  const caseData = recordFromJson(caseApi.body);
  checks.push({
    name: "真实评测案例 API",
    ok: caseApi.status === 200 && Boolean(caseData?.evaluation),
    detail: `${caseSlug} · HTTP ${caseApi.status}`,
  });
  checks.push({
    name: "真实评测案例页面",
    ok: casePage.status === 200 && casePage.body.includes("评测报告"),
    detail: `${caseSlug} · HTTP ${casePage.status}`,
  });

  const anonymousData = recordFromJson(anonymousEvaluation.body);
  checks.push({
    name: "匿名评测保护",
    ok: anonymousEvaluation.status === 401 && anonymousData?.code === "AUTH_REQUIRED",
    detail: `HTTP ${anonymousEvaluation.status}`,
  });

  protectedPaths.forEach((path, index) => {
    const result = protectedPages[index];
    checks.push({
      name: `${path} 登录保护`,
      ok: Boolean(result && protectedRedirect(result, path)),
      detail: result ? `HTTP ${result.status} · ${result.headers.get("location") ?? "无跳转"}` : "无响应",
    });
  });

  const rankingResults = await Promise.all(["daily", "weekly", "monthly"].map(async (period) => {
    const result = await request(`/api/rankings?period=${period}&limit=3`);
    return { period, result, data: recordFromJson(result.body) };
  }));
  for (const { period, result, data } of rankingResults) {
    const count = typeof data?.count === "number" ? data.count : 0;
    checks.push({
      name: `${period} 榜单`,
      ok: result.status === 200 && count > 0 && data?.isStale === false,
      detail: `HTTP ${result.status} · ${count} 条 · 快照 ${String(data?.snapshotDate ?? "无")}`,
    });
  }

  for (const check of checks) console.log(`[seo] ${check.ok ? "✅" : "❌"} ${check.name}: ${check.detail}`);
  const failures = checks.filter((check) => !check.ok);
  if (failures.length > 0) throw new Error(`${failures.length} 项 SEO 健康检查未通过`);
}

main().catch((error) => {
  console.error("[seo] 健康检查失败", error);
  process.exit(1);
});
