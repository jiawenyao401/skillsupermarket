import Link from "next/link";
import { db } from "@/lib/db";
import { skills, evaluations } from "@/lib/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { SkillCard } from "@/components/SkillCard";
import { RankingTabs } from "@/components/RankingTabs";
import { SearchBar } from "@/components/SearchBar";
import { formatNumber, relativeTime } from "@/lib/utils";
import type { SkillType, Evaluation } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // 1 hour

async function getHomeData() {
  // 最新收录
  const latest = await db
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
    })
    .from(skills)
    .where(eq(skills.status, "active"))
    .orderBy(desc(skills.firstSeenAt))
    .limit(12);

  // 评分最高的
  const topRated = await db
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
    .from(evaluations)
    .innerJoin(skills, eq(skills.id, evaluations.skillId))
    .where(eq(skills.status, "active"))
    .orderBy(desc(evaluations.overallScore))
    .limit(8);

  // 基础统计
  const [stats] = await db
    .select({
      totalSkills: sql<number>`COUNT(*)`,
      totalMcp: sql<number>`COUNT(*) FILTER (WHERE ${skills.type} = 'mcp-server')`,
      totalSkill: sql<number>`COUNT(*) FILTER (WHERE ${skills.type} = 'claude-skill')`,
      totalAgent: sql<number>`COUNT(*) FILTER (WHERE ${skills.type} = 'agent-pack')`,
    })
    .from(skills)
    .where(eq(skills.status, "active"));

  return { latest, topRated, stats };
}

export default async function HomePage() {
  const { latest, topRated, stats } = await getHomeData();

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-8">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          发现最火的 <span className="text-primary">AI 技能</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Claude Skills · MCP Servers · Agent Packs 的发现、评测、跟踪
        </p>
        <div className="mt-6 max-w-xl mx-auto">
          <SearchBar />
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          {formatNumber(stats?.totalSkills ?? 0)} 个技能 ·{" "}
          {formatNumber(stats?.totalSkill ?? 0)} Claude Skills ·{" "}
          {formatNumber(stats?.totalMcp ?? 0)} MCP Servers ·{" "}
          {formatNumber(stats?.totalAgent ?? 0)} Agent Packs
        </div>
      </section>

      {/* 三大榜单 */}
      <section>
        <h2 className="text-2xl font-bold mb-4">🔥 热度榜单</h2>
        <RankingTabs />
      </section>

      {/* Top Rated */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">⭐ 评分最高</h2>
          <Link href="/search?sort=score" className="text-sm text-primary hover:underline">
            查看全部 →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {topRated.map((skill) => (
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
      </section>

      {/* 最新收录 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">🆕 最新收录</h2>
          <Link href="/search?sort=newest" className="text-sm text-primary hover:underline">
            查看全部 →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {latest.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={{
                ...skill,
                tags: skill.tags ?? [],
                firstSeenAt: skill.firstSeenAt ?? new Date(),
                githubStars: skill.githubStars ?? 0,
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
