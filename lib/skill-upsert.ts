import "server-only";
import { eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "./db";
import { skills } from "./schema";
import type { EvaluationSource } from "./source-parser";
import {
  resolveSourceSlug,
  evaluationSourceLookupUrls,
  skillMatchesEvaluationSource,
  sourceSlugPlan,
} from "./skill-source-identity";

type SkillUpsertValues = Omit<
  typeof skills.$inferInsert,
  "id" | "slug" | "source" | "createdAt"
>;

export class SourceIdentityConflictError extends Error {
  constructor() {
    super("A public slug is already bound to a different source identity");
    this.name = "SourceIdentityConflictError";
  }
}

async function loadSourceCandidates(source: EvaluationSource) {
  const plan = sourceSlugPlan(source);
  const urls = evaluationSourceLookupUrls(source);
  return db.select().from(skills).where(or(
    inArray(skills.slug, [plan.base, plan.collisionSafe]),
    ...urls.flatMap((url) => [ilike(skills.repoUrl, url), ilike(skills.packageUrl, url)]),
  ));
}

export async function findSkillByEvaluationSource(source: EvaluationSource) {
  const records = await loadSourceCandidates(source);
  return records.find((record) => skillMatchesEvaluationSource(record, source)) ?? null;
}

async function updateMatchedSkill(
  record: typeof skills.$inferSelect,
  source: EvaluationSource,
  values: SkillUpsertValues,
) {
  const [updated] = await db.update(skills).set({
    ...values,
    ...(record.source === null ? { source: source.kind } : {}),
  }).where(eq(skills.id, record.id)).returning();
  if (!updated) throw new Error("项目元数据更新失败");
  return updated;
}

/**
 * Concurrency-safe upsert keyed by immutable registry identity. The readable
 * base slug remains compatible for existing URLs; only real collisions get a
 * deterministic, source-bound suffix.
 */
export async function upsertSkillByEvaluationSource(
  source: EvaluationSource,
  values: SkillUpsertValues,
) {
  let records = await loadSourceCandidates(source);
  const initial = resolveSourceSlug(records, source);
  if (initial.existing) return updateMatchedSkill(initial.existing, source, values);
  if (initial.conflict) throw new SourceIdentityConflictError();

  const plan = sourceSlugPlan(source);
  const attempts = initial.slug === plan.base ? [plan.base, plan.collisionSafe] : [plan.collisionSafe];
  for (const slug of attempts) {
    const [created] = await db.insert(skills).values({
      ...values,
      slug,
      source: source.kind,
    }).onConflictDoNothing().returning();
    if (created) return created;

    // Another request won the unique-slug race. It is safe to update only if
    // the winner proves the same immutable source identity.
    const [concurrent] = await db.select().from(skills).where(eq(skills.slug, slug)).limit(1);
    if (concurrent && skillMatchesEvaluationSource(concurrent, source)) {
      return updateMatchedSkill(concurrent, source, values);
    }
    records = concurrent ? [...records, concurrent] : records;
  }

  const finalResolution = resolveSourceSlug(records, source);
  if (finalResolution.existing) return updateMatchedSkill(finalResolution.existing, source, values);
  throw new SourceIdentityConflictError();
}
