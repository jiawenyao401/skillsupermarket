import type { MetadataRoute } from "next";
import { absoluteUrl } from "./site";

export interface SkillSitemapSource {
  slug: string;
  createdAt: Date | null;
  lastUpdatedAt: Date | null;
  lastEvaluatedAt: Date | null;
}

function latestDate(...dates: Array<Date | null>): Date | undefined {
  const timestamps = dates
    .filter((date): date is Date => date instanceof Date && Number.isFinite(date.getTime()))
    .map((date) => date.getTime());

  return timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined;
}

export function skillSitemapEntry(skill: SkillSitemapSource): MetadataRoute.Sitemap[number] {
  const hasEvaluation = skill.lastEvaluatedAt !== null;

  return {
    url: absoluteUrl(`/skill/${encodeURIComponent(skill.slug)}`),
    lastModified: latestDate(skill.createdAt, skill.lastUpdatedAt, skill.lastEvaluatedAt),
    changeFrequency: "weekly",
    priority: hasEvaluation ? 0.85 : 0.6,
  };
}
