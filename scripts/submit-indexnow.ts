import "dotenv/config";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "../lib/db";
import { INDEXNOW_KEY, submitIndexNowPayload } from "../lib/indexnow";
import { GUIDES } from "../lib/guides";
import { skills } from "../lib/schema";
import { SITE_URL, absoluteUrl } from "../lib/site";

const UPDATED_WINDOW_HOURS = 30;

async function main() {
  const since = new Date(Date.now() - UPDATED_WINDOW_HOURS * 60 * 60 * 1000);
  const changed = await db
    .select({ slug: skills.slug, category: skills.category })
    .from(skills)
    .where(and(eq(skills.status, "active"), gte(skills.lastUpdatedAt, since)))
    .orderBy(desc(skills.lastUpdatedAt))
    .limit(9_990);

  const urlList = Array.from(new Set([
    absoluteUrl("/"),
    absoluteUrl("/evaluation"),
    absoluteUrl("/mcp-server-security-scan"),
    absoluteUrl("/guides"),
    ...GUIDES.map((guide) => absoluteUrl(`/guides/${guide.slug}`)),
    absoluteUrl("/sitemap.xml"),
    ...changed.flatMap((skill) => [
      absoluteUrl(`/skill/${encodeURIComponent(skill.slug)}`),
      ...(skill.category ? [absoluteUrl(`/category/${encodeURIComponent(skill.category)}`)] : []),
    ]),
  ])).slice(0, 10_000);

  const result = await submitIndexNowPayload({
    host: new URL(SITE_URL).host,
    key: INDEXNOW_KEY,
    keyLocation: absoluteUrl(`/${INDEXNOW_KEY}.txt`),
    urlList,
  });

  console.log(
    `[indexnow] 已提交 ${urlList.length} 个新增或更新 URL（${new URL(result.endpoint).hostname} · HTTP ${result.status}）`,
  );
}

main().catch((error) => {
  console.error("[indexnow] 提交失败", error);
  process.exit(1);
});
