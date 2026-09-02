import "dotenv/config";
import { and, asc, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { getReadmeDocument } from "../lib/github";
import { readmeCacheValues } from "../lib/readme-cache";
import { skillReadmes, skills } from "../lib/schema";
import { parseEvaluationSource } from "../lib/source-parser";

function boundedInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(maximum, parsed));
}

async function main() {
  const defaultBatch = process.env.GITHUB_TOKEN ? 12 : 3;
  const batchSize = boundedInteger(process.env.README_CACHE_BATCH, defaultBatch, 20);
  const ttlDays = boundedInteger(process.env.README_CACHE_TTL_DAYS, 14, 30) || 14;
  if (batchSize === 0) {
    console.log("[readme-cache] disabled by README_CACHE_BATCH=0");
    return;
  }

  const staleBefore = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1_000);
  const candidates = await db
    .select({
      id: skills.id,
      slug: skills.slug,
      repoUrl: skills.repoUrl,
      readmeCachedAt: skillReadmes.readmeCachedAt,
      githubStars: skills.githubStars,
    })
    .from(skills)
    .leftJoin(skillReadmes, eq(skillReadmes.skillId, skills.id))
    .where(and(
      eq(skills.status, "active"),
      sql`${skills.repoUrl} ~* '^https://github[.]com/[^/]+/[^/]+'`,
      or(isNull(skillReadmes.readmeCachedAt), lt(skillReadmes.readmeCachedAt, staleBefore)),
    ))
    .orderBy(asc(skillReadmes.readmeCachedAt), desc(skills.githubStars))
    .limit(batchSize);

  let cached = 0;
  let missing = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const source = candidate.repoUrl ? parseEvaluationSource(candidate.repoUrl) : null;
    if (!source || source.kind !== "github") continue;
    try {
      const document = await getReadmeDocument(source.fullName, undefined, true);
      const values = readmeCacheValues(document);
      await db.insert(skillReadmes).values({ skillId: candidate.id, ...values }).onConflictDoUpdate({
        target: skillReadmes.skillId,
        set: values,
      });
      if (document) cached += 1;
      else missing += 1;
    } catch (error) {
      failed += 1;
      console.error(`[readme-cache] ${candidate.slug}: ${error instanceof Error ? error.message : "upstream failure"}`);
    }
  }

  console.log(`[readme-cache] cached=${cached} missing=${missing} failed=${failed} selected=${candidates.length} ttl=${ttlDays}d`);
  if (failed > 0 && cached + missing === 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[readme-cache] fatal", error);
  process.exit(1);
});
