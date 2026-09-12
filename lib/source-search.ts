import { and, eq, isNull, or, sql } from "drizzle-orm";
import { skills } from "./schema";
import { normalizeEvaluationSource, parseEvaluationSource, type EvaluationSource } from "./source-parser";

/** Keep address lookup distinct from free-text search (e.g. a tool named 'react'). */
export function sourceSearchInput(value: unknown): string | null {
  return typeof value === "string" ? normalizeEvaluationSource(value) : null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sourceSearchPatterns(source: EvaluationSource) {
  if (source.kind === "github") {
    return { url: `^https?://(www\\.)?github\\.com/${escapeRegex(source.fullName)}(\\.git)?([/?#].*)?$`, name: null };
  }
  if (source.kind === "npm") {
    const name = escapeRegex(source.name).replace("@", "(@|%40)").replace("/", "(/|%2f)");
    return { url: `^https?://(www\\.)?npmjs\\.com/package/${name}/?([?#].*)?$`, name: `^${escapeRegex(source.name)}$` };
  }
  const name = source.name.split(/[-_.]+/).map(escapeRegex).join("[-_.]+");
  return { url: `^https?://(www\\.)?pypi\\.org/project/${name}/?([?#].*)?$`, name: `^${name}$` };
}

/** Bound parameters and anchored registry identities; never fetch the submitted URL. */
export function sourceSearchCondition(input: string) {
  const source = parseEvaluationSource(input);
  if (!source) return sql`false`;
  const pattern = sourceSearchPatterns(source);
  const sourceKind = or(eq(skills.source, source.kind), eq(skills.source, "official"), eq(skills.source, "manual"), isNull(skills.source));
  const url = source.kind === "github" ? skills.repoUrl : skills.packageUrl;
  return and(sourceKind, or(
    sql`${url} ~* ${pattern.url}`,
    // Collector rows without a registry URL may use the canonical package name.
    // A different stored URL must never be overridden by a coincidentally equal name.
    pattern.name ? and(eq(skills.source, source.kind), or(isNull(url), eq(url, "")), sql`${skills.name} ~* ${pattern.name}`) : undefined,
  ))!;
}
