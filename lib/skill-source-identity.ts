import { createHash } from "node:crypto";
import { parseEvaluationSource, type EvaluationSource } from "./source-parser";
import { slugify } from "./utils";

export interface StoredSkillSource {
  slug: string;
  source: "official" | "github" | "npm" | "pypi" | "manual" | null;
  name: string;
  repoUrl: string | null;
  packageUrl: string | null;
}

export interface SourceSlugPlan {
  base: string;
  collisionSafe: string;
}

export interface SourceSlugResolution<T extends StoredSkillSource> {
  existing: T | null;
  slug: string;
  conflict: boolean;
}

/** Public registries have different canonical-name rules; keep the kind in the identity. */
export function evaluationSourceKey(source: EvaluationSource): string {
  if (source.kind === "github") return `github:${source.fullName.toLowerCase()}`;
  if (source.kind === "pypi") return `pypi:${source.name.toLowerCase().replace(/[-_.]+/g, "-")}`;
  return `npm:${source.name.toLowerCase()}`;
}

export function sourceSlugPlan(source: EvaluationSource): SourceSlugPlan {
  const sourceName = source.kind === "github" ? source.fullName : source.name;
  const base = slugify(sourceName);
  const digest = createHash("sha256").update(evaluationSourceKey(source)).digest("hex").slice(0, 24);
  const suffix = `-${source.kind}-${digest}`;
  return {
    base,
    collisionSafe: `${base.slice(0, 80 - suffix.length)}${suffix}`,
  };
}

export function evaluationSourceLookupUrls(source: EvaluationSource): string[] {
  if (source.kind === "github") return [`https://github.com/${source.fullName}`];
  if (source.kind === "npm") return [`https://www.npmjs.com/package/${source.name}`];
  return [
    `https://pypi.org/project/${source.name}/`,
    `https://pypi.org/project/${source.name}`,
  ];
}

function parseCandidate(value: string | null): EvaluationSource[] {
  const parsed = value ? parseEvaluationSource(value) : null;
  return parsed ? [parsed] : [];
}

function storedEvaluationSources(skill: StoredSkillSource): EvaluationSource[] {
  if (skill.source === "github") return parseCandidate(skill.repoUrl);
  if (skill.source === "npm") {
    return parseCandidate(skill.packageUrl).length
      ? parseCandidate(skill.packageUrl)
      : parseCandidate(skill.name);
  }
  if (skill.source === "pypi") {
    return parseCandidate(skill.packageUrl).length
      ? parseCandidate(skill.packageUrl)
      : parseCandidate(`pypi:${skill.name}`);
  }

  // Curated/manual and legacy rows may intentionally point at a verified public
  // source. They are claimable only when one of those stored canonical URLs is
  // an exact identity match; the readable slug alone is never sufficient.
  if (skill.source === "official" || skill.source === "manual" || skill.source === null) {
    return [...parseCandidate(skill.repoUrl), ...parseCandidate(skill.packageUrl)];
  }
  return [];
}

export function skillMatchesEvaluationSource(skill: StoredSkillSource, source: EvaluationSource): boolean {
  const expectedKey = evaluationSourceKey(source);
  return storedEvaluationSources(skill).some((stored) => evaluationSourceKey(stored) === expectedKey);
}

/**
 * Resolve a stable public slug without ever treating a colliding slug as proof
 * that two registry entries are the same project.
 */
export function resolveSourceSlug<T extends StoredSkillSource>(
  records: readonly T[],
  source: EvaluationSource,
): SourceSlugResolution<T> {
  const plan = sourceSlugPlan(source);
  const existing = records.find((record) => skillMatchesEvaluationSource(record, source)) ?? null;
  if (existing) return { existing, slug: existing.slug, conflict: false };

  const baseTaken = records.some((record) => record.slug === plan.base);
  const slug = baseTaken ? plan.collisionSafe : plan.base;
  const conflict = records.some((record) => record.slug === slug);
  return { existing: null, slug, conflict };
}
