import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Braces,
  ChartNoAxesCombined,
  Code2,
  Database,
  Palette,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db";
import { skills, evaluations } from "@/lib/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { SkillCard } from "@/components/SkillCard";
import { RankingTabs } from "@/components/RankingTabs";
import { JsonLd } from "@/components/JsonLd";
import { SearchBar } from "@/components/SearchBar";
import { formatNumber } from "@/lib/utils";
import { getRankings } from "@/lib/ranker";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const CATEGORY_LINKS = [
  {
    name: "开发与代码",
    description: "编码、调试、测试与自动化",
    href: "/category/programming",
    icon: Code2,
    className: "bg-sky-500/10 text-sky-700",
  },
  {
    name: "数据与知识",
    description: "数据库、分析、搜索与 ETL",
    href: "/category/data",
    icon: Database,
    className: "bg-violet-500/10 text-violet-700",
  },
  {
    name: "设计与创意",
    description: "UI、视觉、内容与生成工具",
    href: "/category/design",
    icon: Palette,
    className: "bg-pink-500/10 text-pink-700",
  },
  {
    name: "效率与办公",
    description: "文档、协作与日常工作流",
    href: "/category/productivity",
    icon: Zap,
    className: "bg-amber-500/10 text-amber-700",
  },
] as const;

async function getHomeData() {
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
    .limit(6);

  const latestEvaluations = db
    .selectDistinctOn([evaluations.skillId], {
      skillId: evaluations.skillId,
      overallScore: evaluations.overallScore,
      evaluationId: evaluations.id,
    })
    .from(evaluations)
    .orderBy(evaluations.skillId, desc(evaluations.evaluatedAt))
    .as("latest_evaluations");

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
      overallScore: latestEvaluations.overallScore,
      report: evaluations.report,
    })
    .from(skills)
    .innerJoin(latestEvaluations, eq(skills.id, latestEvaluations.skillId))
    .innerJoin(evaluations, and(
      eq(evaluations.id, latestEvaluations.evaluationId),
    ))
    .where(eq(skills.status, "active"))
    .orderBy(
      desc(sql`CASE WHEN ${evaluations.report}->'methodology'->>'caseStudy' = 'true' THEN 1 ELSE 0 END`),
      desc(evaluations.evaluatedAt)
    )
    .limit(4);

  const [stats] = await db
    .select({
      totalSkills: sql<number>`COUNT(*)`,
      totalMcp: sql<number>`COUNT(*) FILTER (WHERE ${skills.type} = 'mcp-server')`,
      totalSkill: sql<number>`COUNT(*) FILTER (WHERE ${skills.type} = 'claude-skill')`,
      totalAgent: sql<number>`COUNT(*) FILTER (WHERE ${skills.type} = 'agent-pack')`,
    })
    .from(skills)
    .where(eq(skills.status, "active"));

  const dailyRanking = await getRankings("daily", 6);

  return { latest, topRated, stats, dailyRanking };
}

export default async function HomePage() {
  const { latest, topRated, stats, dailyRanking } = await getHomeData();

  const total = stats?.totalSkills ?? 0;
  const typeStats = [
    { label: "AI Skills", value: stats?.totalSkill ?? 0, icon: Sparkles },
    { label: "MCP Servers", value: stats?.totalMcp ?? 0, icon: Braces },
    { label: "Agent Packs", value: stats?.totalAgent ?? 0, icon: Bot },
  ];

  return (
    <div className="space-y-20 sm:space-y-24">
      {dailyRanking.items.length > 0 && (
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "正在升温的 AI 能力",
          numberOfItems: dailyRanking.items.length,
          itemListElement: dailyRanking.items.map((skill) => ({
            "@type": "ListItem",
            position: skill.rank,
            name: skill.name,
            url: absoluteUrl(`/skill/${encodeURIComponent(skill.slug)}`),
          })),
        }} />
      )}
      <section className="relative overflow-hidden rounded-[2rem] border bg-card px-5 py-12 shadow-sm sm:px-10 sm:py-16 lg:px-16 lg:py-20">
        <div className="hero-grid" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <Link
            href="/evaluation"
            className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            收录前经过自动评测与安全扫描
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <h1 className="text-balance text-4xl font-black leading-[1.06] tracking-[-0.055em] sm:text-6xl lg:text-[4.5rem]">
            给你的 AI，找到
            <span className="hero-highlight">下一项超能力</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            浏览、比较和评测社区最优秀的 AI Skills、MCP Servers 与 Agent Packs。少踩坑，更快构建真正有用的 AI 工作流。
          </p>

          <form
            action="/evaluate"
            method="get"
            className="mx-auto mt-8 max-w-2xl rounded-2xl border bg-background/90 p-2 text-left shadow-lg shadow-primary/5 backdrop-blur"
          >
            <label className="sr-only" htmlFor="homepage-evaluation-source">公开项目地址或包名</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="homepage-evaluation-source"
                name="source"
                type="text"
                inputMode="url"
                autoComplete="url"
                maxLength={500}
                required
                aria-describedby="homepage-evaluation-help"
                placeholder="粘贴 GitHub 地址，或输入 npm / pypi:包名"
                className="h-12 min-w-0 flex-1 rounded-xl border bg-card px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button type="submit" className="button-primary h-12 shrink-0 px-5 text-sm">
                免费生成评测 <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
            <p id="homepage-evaluation-help" className="mt-2 flex items-center gap-1.5 px-2 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              支持公开 GitHub、npm 与 PyPI 项目；登录后自动带入，无需重复填写。
            </p>
          </form>

          <div className="mx-auto mt-6 max-w-2xl">
            <div className="mb-3 text-xs font-medium text-muted-foreground">或者先搜索已收录的能力</div>
            <SearchBar size="large" autoFocusHint />
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span>热门搜索</span>
              {["GitHub", "Postgres", "Notion", "Browser"].map((term) => (
                <Link key={term} href={`/search?q=${encodeURIComponent(term)}`} className="font-medium hover:text-foreground">
                  {term}
                </Link>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 divide-x rounded-2xl border bg-background/70 py-4 shadow-sm backdrop-blur">
            {typeStats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="px-2 sm:px-5">
                <div className="flex items-center justify-center gap-1.5 font-extrabold tracking-tight sm:text-xl">
                  <Icon className="hidden h-4 w-4 text-primary sm:block" />
                  {formatNumber(value)}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground sm:text-xs">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="section-eyebrow">Browse by category</div>
            <h2 className="section-title mt-2">从你的任务开始</h2>
            <p className="section-description">不必先理解工具分类，直接按工作场景找到合适的能力。</p>
          </div>
          <Link href="/search" className="hidden items-center gap-1 text-sm font-semibold hover:text-primary sm:flex">
            查看全部 {formatNumber(total)} 个 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORY_LINKS.map(({ name, description, href, icon: Icon, className }) => (
            <Link key={href} href={href} className="category-card group">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${className}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="mt-5 flex items-center justify-between gap-2">
                <span className="font-bold">{name}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </span>
              <span className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="section-eyebrow">Trending now</div>
            <h2 className="section-title mt-2">正在升温的 AI 能力</h2>
            <p className="section-description">综合增长、下载与活跃度计算，不只是总 Star 数。</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            每 6 小时自动更新
          </div>
        </div>
        <RankingTabs
          initialData={dailyRanking.items}
          initialSnapshotDate={dailyRanking.snapshotDate}
          initialIsStale={dailyRanking.isStale}
        />
      </section>

      {topRated.length > 0 && (
        <section className="rounded-[2rem] bg-foreground px-5 py-10 text-background sm:px-8 sm:py-12">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                <ShieldCheck className="h-4 w-4" /> Evaluation cases
              </div>
              <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">真实 Skill 评测案例</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-background/60 sm:text-base">
                展示经过真实仓库证据、静态安全扫描与 AI Judge 复核的代表案例。
              </p>
            </div>
            <Link href="/search?sort=score" className="inline-flex items-center gap-1 text-sm font-semibold text-background/70 hover:text-background">
              查看完整评分榜 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {topRated.map((skill) => (
              <SkillCard
                key={skill.id}
                tone="dark"
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
      )}

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="section-eyebrow">Fresh arrivals</div>
            <h2 className="section-title mt-2">刚刚加入市场</h2>
            <p className="section-description">发现社区近期发布的新能力，在它们流行之前先试一步。</p>
          </div>
          <Link href="/search?sort=newest" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold hover:text-primary">
            全部最新 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {latest.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        ) : (
          <div className="surface-card flex flex-col items-center px-6 py-12 text-center">
            <WandSparkles className="h-8 w-8 text-primary" />
            <div className="mt-3 font-bold">新能力正在上架</div>
            <p className="mt-1 text-sm text-muted-foreground">稍后回来看看，或提交一个你正在使用的项目。</p>
            <Link href="/evaluate" className="button-primary mt-5 h-10 px-5 text-sm">提交项目</Link>
          </div>
        )}
      </section>

      <section className="relative overflow-hidden rounded-[2rem] border bg-card px-6 py-10 sm:px-10 sm:py-12">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <div className="section-eyebrow flex items-center gap-2"><ChartNoAxesCombined className="h-4 w-4" /> Open evaluation</div>
            <h2 className="section-title mt-2">你的项目，也值得被更多人看见</h2>
            <p className="section-description">
              提交 GitHub 仓库、npm 或 PyPI 包。系统会抓取元数据、扫描风险、生成五维评分，并自动进入市场索引。
            </p>
          </div>
          <Link href="/evaluate" className="button-primary h-12 px-6 text-sm">
            开始免费评测 <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
