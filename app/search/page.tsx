import { db } from "@/lib/db";
import { skills, evaluations } from "@/lib/schema";
import { eq, desc, sql, and, or, ilike } from "drizzle-orm";
import { SkillCard } from "@/components/SkillCard";
import { SearchBar } from "@/components/SearchBar";
import Link from "next/link";

interface PageProps {
  searchParams: { q?: string; tag?: string; sort?: string; type?: string };
}

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: PageProps) {
  const { q, tag, sort = "stars", type } = searchParams;

  const conditions = [eq(skills.status, "active")];
  if (q) {
    conditions.push(
      or(
        ilike(skills.name, `%${q}%`),
        ilike(skills.description, `%${q}%`),
        sql`${skills.tags} && ARRAY[${q}]::text[]`
      )!
    );
  }
  if (tag) {
    conditions.push(sql`${skills.tags} @> ARRAY[${tag}]::text[]`);
  }
  if (type && ["claude-skill", "mcp-server", "agent-pack"].includes(type)) {
    conditions.push(eq(skills.type, type as any));
  }

  const orderBy = (() => {
    switch (sort) {
      case "newest":
        return desc(skills.firstSeenAt);
      case "score":
        return desc(evaluations.overallScore);
      case "updated":
        return desc(skills.lastUpdatedAt);
      default:
        return desc(skills.githubStars);
    }
  })();

  let query = db
    .select({
      id: skills.id,
      slug: skills.slug,
      name: skills.name,
      description: skills.description,
      type: skills.type,
      category: skills.category,
      tags: skills.tags,
      authorName: skills.authorName,
      authorAvatar: skills.authorAvatar,
      githubStars: skills.githubStars,
      license: skills.license,
      firstSeenAt: skills.firstSeenAt,
      overallScore: evaluations.overallScore,
    })
    .from(skills)
    .leftJoin(evaluations, eq(evaluations.skillId, skills.id))
    .where(and(...conditions));

  const results = sort === "score"
    ? await query.orderBy(desc(evaluations.overallScore)).limit(50)
    : await query.orderBy(orderBy).limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-4">搜索</h1>
        <SearchBar initial={q} />
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link
            href={`/search?${new URLSearchParams({ ...(q ? { q } : {}), sort: "stars" }).toString()}`}
            className={`px-3 py-1 rounded ${sort === "stars" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            ⭐ Stars
          </Link>
          <Link
            href={`/search?${new URLSearchParams({ ...(q ? { q } : {}), sort: "score" }).toString()}`}
            className={`px-3 py-1 rounded ${sort === "score" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            💯 评分
          </Link>
          <Link
            href={`/search?${new URLSearchParams({ ...(q ? { q } : {}), sort: "newest" }).toString()}`}
            className={`px-3 py-1 rounded ${sort === "newest" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            🆕 最新
          </Link>
          <Link
            href={`/search?${new URLSearchParams({ ...(q ? { q } : {}), sort: "updated" }).toString()}`}
            className={`px-3 py-1 rounded ${sort === "updated" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            🔄 最近更新
          </Link>
        </div>
        {tag && (
          <div className="mt-3 text-sm">
            标签: <span className="px-2 py-0.5 bg-primary/10 text-primary rounded">#{tag}</span>
            <Link href={`/search?q=${q ?? ""}`} className="ml-2 text-muted-foreground hover:underline">
              清除
            </Link>
          </div>
        )}
        <p className="mt-3 text-sm text-muted-foreground">找到 {results.length} 个结果</p>
      </div>

      {results.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">未找到匹配的技能</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={{
                ...skill,
                tags: skill.tags ?? [],
                firstSeenAt: skill.firstSeenAt ?? new Date(),
                githubStars: skill.githubStars ?? 0,
              }}
              score={skill.overallScore ?? undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
