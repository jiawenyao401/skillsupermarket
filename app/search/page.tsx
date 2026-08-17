import Link from "next/link";
import type { Metadata } from "next";
import { Filter, SearchX, SlidersHorizontal } from "lucide-react";
import { db } from "@/lib/db";
import { skills, evaluations } from "@/lib/schema";
import { eq, desc, sql, and, or, ilike } from "drizzle-orm";
import { SkillCard } from "@/components/SkillCard";
import { SearchBar } from "@/components/SearchBar";
import { cn } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ q?: string; tag?: string; sort?: string; type?: string }>;
}

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "搜索 AI Skills、MCP Servers 与 Agent Packs",
  description: "搜索并筛选 Skill Supermarket 收录的 AI Skills、MCP Servers 与 Agent Packs。",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
};

const SORT_OPTIONS = [
  { value: "stars", label: "最受欢迎" },
  { value: "score", label: "评分最高" },
  { value: "newest", label: "最新收录" },
  { value: "updated", label: "最近更新" },
] as const;

const TYPE_OPTIONS = [
  { value: "", label: "全部类型" },
  { value: "claude-skill", label: "AI Skills" },
  { value: "mcp-server", label: "MCP Servers" },
  { value: "agent-pack", label: "Agent Packs" },
] as const;

type SearchParams = Awaited<PageProps["searchParams"]>;

function createSearchHref(current: SearchParams, changes: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  const merged = { ...current, ...changes };
  Object.entries(merged).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

export default async function SearchPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const q = resolvedSearchParams.q?.trim();
  const tag = resolvedSearchParams.tag?.trim();
  const sort = SORT_OPTIONS.some((option) => option.value === resolvedSearchParams.sort) ? resolvedSearchParams.sort! : "stars";
  const type = TYPE_OPTIONS.some((option) => option.value === resolvedSearchParams.type) ? resolvedSearchParams.type : "";

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
  if (tag) conditions.push(sql`${skills.tags} @> ARRAY[${tag}]::text[]`);
  if (type && ["claude-skill", "mcp-server", "agent-pack"].includes(type)) {
    conditions.push(eq(skills.type, type as "claude-skill" | "mcp-server" | "agent-pack"));
  }

  const latestEvaluations = db
    .selectDistinctOn([evaluations.skillId], {
      skillId: evaluations.skillId,
      overallScore: evaluations.overallScore,
    })
    .from(evaluations)
    .orderBy(evaluations.skillId, desc(evaluations.evaluatedAt))
    .as("latest_evaluations");

  const orderBy = sort === "newest"
    ? desc(skills.firstSeenAt)
    : sort === "score"
      ? desc(latestEvaluations.overallScore)
      : sort === "updated"
        ? desc(skills.lastUpdatedAt)
        : desc(skills.githubStars);

  const results = await db
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
      overallScore: latestEvaluations.overallScore,
    })
    .from(skills)
    .leftJoin(latestEvaluations, eq(latestEvaluations.skillId, skills.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(50);

  const searchContext = q ? `“${q}”` : tag ? `#${tag}` : "全部能力";

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border bg-card px-5 py-8 sm:px-8 sm:py-10">
        <div className="section-eyebrow">Explore the market</div>
        <h1 className="section-title mt-2">搜索 AI 能力</h1>
        <p className="section-description">按名称、场景或技术栈搜索，再用类型与数据维度缩小范围。</p>
        <div className="mt-6 max-w-3xl"><SearchBar initial={q ?? ""} size="large" /></div>
      </section>

      <section>
        <div className="flex flex-col gap-5 border-b pb-6">
          <div className="flex items-center gap-2 text-sm font-bold"><SlidersHorizontal className="h-4 w-4" /> 筛选结果</div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2" aria-label="类型筛选">
              {TYPE_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={createSearchHref(resolvedSearchParams, { type: option.value || undefined })}
                  className={cn("filter-pill", (type ?? "") === option.value && "filter-pill-active")}
                >
                  {option.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" aria-label="排序方式">
              {SORT_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={createSearchHref(resolvedSearchParams, { sort: option.value })}
                  className={cn("filter-pill", sort === option.value && "filter-pill-active")}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>
          {tag && (
            <div className="flex items-center gap-2 text-sm">
              <Filter className="h-4 w-4 text-primary" />
              标签 <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">#{tag}</span>
              <Link href={createSearchHref(resolvedSearchParams, { tag: undefined })} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">清除</Link>
            </div>
          )}
        </div>

        <div className="my-6 flex items-center justify-between gap-4">
          <h2 className="font-bold">{searchContext}</h2>
          <span className="text-sm text-muted-foreground">{results.length} 个结果</span>
        </div>

        {results.length === 0 ? (
          <div className="surface-card flex flex-col items-center px-6 py-16 text-center">
            <SearchX className="h-9 w-9 text-primary" />
            <h2 className="mt-4 text-lg font-bold">没有找到匹配项</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">试试更宽泛的关键词、清除类型筛选，或提交这个项目让它加入市场。</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/search" className="filter-pill">清除全部筛选</Link>
              <Link href="/evaluate" className="button-primary h-9 px-4 text-sm">提交项目</Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
      </section>
    </div>
  );
}
