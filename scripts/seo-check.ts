import "dotenv/config";
import { SITE_URL } from "../lib/site";

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

async function get(path: string): Promise<{ status: number; body: string; headers: Headers }> {
  const response = await fetch(new URL(path, `${SITE_URL}/`), {
    headers: { "User-Agent": "SkillSupermarketSEOHealth/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  return { status: response.status, body: await response.text(), headers: response.headers };
}

async function main() {
  const checks: CheckResult[] = [];
  const [home, robots, sitemap] = await Promise.all([get("/"), get("/robots.txt"), get("/sitemap.xml")]);

  checks.push({ name: "首页可访问", ok: home.status === 200, detail: `HTTP ${home.status}` });
  checks.push({
    name: "首页 Canonical",
    ok: /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/skillsupermarket\.com\/?["']/i.test(home.body)
      || /<link[^>]+href=["']https:\/\/skillsupermarket\.com\/?["'][^>]+rel=["']canonical["']/i.test(home.body),
    detail: "应指向 https://skillsupermarket.com/",
  });
  checks.push({ name: "首页结构化数据", ok: home.body.includes("application/ld+json"), detail: "Organization + WebSite" });
  checks.push({ name: "Robots", ok: robots.status === 200 && robots.body.includes("Sitemap:"), detail: `HTTP ${robots.status}` });
  checks.push({
    name: "Sitemap",
    ok: sitemap.status === 200 && sitemap.body.includes("<urlset") && sitemap.body.includes("/skill/"),
    detail: `HTTP ${sitemap.status} · ${(sitemap.body.match(/<loc>/g) ?? []).length} URLs`,
  });

  for (const check of checks) console.log(`[seo] ${check.ok ? "✅" : "❌"} ${check.name}: ${check.detail}`);
  const failures = checks.filter((check) => !check.ok);
  if (failures.length > 0) throw new Error(`${failures.length} 项 SEO 健康检查未通过`);
}

main().catch((error) => {
  console.error("[seo] 健康检查失败", error);
  process.exit(1);
});
