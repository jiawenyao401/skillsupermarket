import type { MetadataRoute } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { skills } from "@/lib/schema";
import { absoluteUrl } from "@/lib/site";
import { GUIDES } from "@/lib/guides";

// Avoid freezing a partial sitemap when the database is temporarily unavailable
// during a deployment build. Crawlers request this route infrequently.
export const dynamic = "force-dynamic";

const staticEntries: MetadataRoute.Sitemap = [
  { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
  { url: absoluteUrl("/evaluation"), changeFrequency: "weekly", priority: 0.9 },
  { url: absoluteUrl("/guides"), changeFrequency: "weekly", priority: 0.8 },
  ...GUIDES.map((guide) => ({
    url: absoluteUrl(`/guides/${guide.slug}`),
    lastModified: new Date(guide.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  })),
  { url: absoluteUrl("/category/programming"), changeFrequency: "daily", priority: 0.8 },
  { url: absoluteUrl("/category/data"), changeFrequency: "daily", priority: 0.8 },
  { url: absoluteUrl("/category/design"), changeFrequency: "daily", priority: 0.8 },
  { url: absoluteUrl("/category/productivity"), changeFrequency: "daily", priority: 0.8 },
  { url: absoluteUrl("/category/other"), changeFrequency: "daily", priority: 0.7 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const list = await db
      .select({
        slug: skills.slug,
        lastUpdatedAt: skills.lastUpdatedAt,
        createdAt: skills.createdAt,
      })
      .from(skills)
      .where(eq(skills.status, "active"))
      .orderBy(asc(skills.slug))
      .limit(50_000 - staticEntries.length);

    return [
      ...staticEntries,
      ...list.map((skill) => ({
        url: absoluteUrl(`/skill/${encodeURIComponent(skill.slug)}`),
        lastModified: skill.lastUpdatedAt ?? skill.createdAt ?? undefined,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch (error) {
    console.error("[sitemap] 无法读取 Skill 列表，返回静态入口", error);
    return staticEntries;
  }
}
