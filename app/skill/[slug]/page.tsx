import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { skills, evaluations, metricsDaily, skillReadmes } from "@/lib/schema";
import { eq, desc, and, gte, asc } from "drizzle-orm";
import { EvaluationReport } from "@/components/EvaluationReport";
import { TrendChart } from "@/components/TrendChart";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatNumber, relativeTime } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Github, Star, GitFork, Download, Calendar, User, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { transformReadmeUrl } from "@/lib/readme";
import { cachedReadmeDocument } from "@/lib/readme-cache";
import Link from "next/link";
import { getSkillEvaluationSource } from "@/lib/skill-evaluation-source";
import { JsonLd } from "@/components/JsonLd";
import { EvaluationBadge } from "@/components/EvaluationBadge";
import { absoluteUrl, compactDescription } from "@/lib/site";
import { cache } from "react";
import type { EvaluationReport as EvaluationReportType } from "@/lib/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const getSkill = cache(async (slug: string) => {
  const [skill] = await db
    .select()
    .from(skills)
    .where(eq(skills.slug, slug));
  if (!skill) return null;

  // 最近 30 天热度趋势
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().split("T")[0];

  const [[evaluation], [readmeSnapshot], trend] = await Promise.all([
    db.select().from(evaluations)
      .where(eq(evaluations.skillId, skill.id))
      .orderBy(desc(evaluations.evaluatedAt))
      .limit(1),
    db.select().from(skillReadmes)
      .where(eq(skillReadmes.skillId, skill.id))
      .limit(1),
    db.select().from(metricsDaily)
      .where(and(eq(metricsDaily.skillId, skill.id), gte(metricsDaily.date, sinceStr)))
      .orderBy(asc(metricsDaily.date)),
  ]);

  return { skill, evaluation, trend, readmeSnapshot };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSkill(slug);
  if (!data) {
    return { title: "Skill 不存在", robots: { index: false, follow: false } };
  }

  const { skill, evaluation } = data;
  const report = evaluation?.report as EvaluationReportType | undefined;
  const scoreLabel = evaluation ? `${evaluation.overallScore} 分` : "待评测";
  const title = `${skill.name} 评测：${scoreLabel}、安全分析与使用建议`;
  const fallback = `${skill.name} 的 AI Skill 评测、项目数据、安全风险、文档质量、活跃度与采用建议。`;
  const description = compactDescription(report?.summary?.headline || skill.description, fallback);
  const canonical = `/skill/${encodeURIComponent(skill.slug)}`;

  return {
    title,
    description,
    keywords: [skill.name, ...(skill.tags ?? []), "AI Skill 评测", "MCP 安全评测"],
    alternates: { canonical },
    authors: skill.authorName ? [{ name: skill.authorName }] : undefined,
    robots: skill.status === "active"
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      type: "article",
      url: canonical,
      title,
      description,
      siteName: "Skill Supermarket",
      publishedTime: skill.createdAt?.toISOString(),
      modifiedTime: (evaluation?.evaluatedAt ?? skill.lastUpdatedAt)?.toISOString(),
      authors: skill.authorName ? [skill.authorName] : undefined,
      tags: skill.tags ?? undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SkillDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getSkill(slug);
  if (!data) notFound();

  const { skill, evaluation, trend, readmeSnapshot } = data;
  const readme = cachedReadmeDocument(readmeSnapshot);

  const typeLabel = {
    "claude-skill": "Claude Skill",
    "mcp-server": "MCP Server",
    "agent-pack": "Agent Pack",
  }[skill.type];
  const evaluationSource = getSkillEvaluationSource(skill);
  const evaluationHref = `/evaluate?skill=${encodeURIComponent(skill.slug)}`;
  const canonicalUrl = absoluteUrl(`/skill/${encodeURIComponent(skill.slug)}`);
  const report = evaluation?.report as EvaluationReportType | undefined;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首页", item: absoluteUrl("/") },
        ...(skill.category ? [{
          "@type": "ListItem",
          position: 2,
          name: skill.category,
          item: absoluteUrl(`/category/${encodeURIComponent(skill.category)}`),
        }] : []),
        { "@type": "ListItem", position: skill.category ? 3 : 2, name: skill.name, item: canonicalUrl },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      "@id": `${canonicalUrl}#software`,
      name: skill.name,
      description: compactDescription(skill.description, `${skill.name} AI 能力项目。`, 300),
      url: canonicalUrl,
      codeRepository: skill.repoUrl ?? undefined,
      downloadUrl: skill.packageUrl ?? undefined,
      license: skill.license ?? undefined,
      dateCreated: skill.createdAt?.toISOString(),
      dateModified: skill.lastUpdatedAt?.toISOString(),
      keywords: skill.tags?.join(", ") || undefined,
      author: skill.authorName ? { "@type": "Person", name: skill.authorName, url: skill.authorUrl ?? undefined } : undefined,
      review: evaluation ? {
        "@type": "Review",
        name: `${skill.name} 证据驱动评测`,
        url: canonicalUrl,
        datePublished: evaluation.evaluatedAt?.toISOString(),
        reviewBody: report?.summary?.headline ?? "基于公开项目证据生成的质量与安全评测。",
        author: { "@type": "Organization", "@id": absoluteUrl("/#organization"), name: "Skill Supermarket" },
        reviewRating: {
          "@type": "Rating",
          ratingValue: evaluation.overallScore,
          bestRating: 100,
          worstRating: 0,
        },
      } : undefined,
    },
  ];

  return (
    <div className="space-y-8">
      <JsonLd data={jsonLd} />
      <Link href="/search" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> 返回能力市场
      </Link>
      {/* Header */}
      <div className="relative overflow-hidden rounded-[2rem] border bg-card p-5 sm:p-8">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="default">{typeLabel}</Badge>
              {skill.category && <Badge variant="secondary">{skill.category}</Badge>}
              {skill.license && <Badge variant="outline">{skill.license}</Badge>}
              {skill.currentVersion && (
                <Badge variant="outline">v{skill.currentVersion}</Badge>
              )}
            </div>
            <h1 className="break-words text-3xl font-black tracking-[-0.04em] sm:text-4xl">{skill.name}</h1>
            {skill.description && (
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{skill.description}</p>
            )}
            {skill.authorName && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                {skill.authorAvatar && (
                  <img
                    src={skill.authorAvatar}
                    alt={skill.authorName}
                    className="w-5 h-5 rounded-full"
                  />
                )}
                <User className="w-4 h-4" />
                <span>{skill.authorName}</span>
              </div>
            )}
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row md:flex-col">
            {skill.repoUrl && (
              <Button asChild className="w-full rounded-xl sm:w-auto">
                <a href={skill.repoUrl} target="_blank" rel="noreferrer">
                  <Github className="w-4 h-4 mr-2" />
                  GitHub <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
            )}
            {skill.packageUrl && (
              <Button variant="outline" asChild className="w-full rounded-xl sm:w-auto">
                <a href={skill.packageUrl} target="_blank" rel="noreferrer">
                  <Download className="w-4 h-4 mr-2" />
                  Package <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="relative mt-7 flex flex-wrap gap-x-6 gap-y-3 border-t pt-5 text-sm">
          {(skill.githubStars ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="font-semibold">{formatNumber(skill.githubStars ?? 0)}</span>
              <span className="text-muted-foreground">stars</span>
            </div>
          )}
          {(skill.githubForks ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              <GitFork className="w-4 h-4" />
              <span className="font-semibold">{formatNumber(skill.githubForks ?? 0)}</span>
              <span className="text-muted-foreground">forks</span>
            </div>
          )}
          {(skill.npmDownloadsWeekly ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              <Download className="w-4 h-4" />
              <span className="font-semibold">{formatNumber(skill.npmDownloadsWeekly ?? 0)}</span>
              <span className="text-muted-foreground">downloads/week</span>
            </div>
          )}
          {skill.githubLastCommit && (
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>最近更新 {relativeTime(skill.githubLastCommit)}</span>
            </div>
          )}
        </div>
      </div>

      {evaluation ? (
        <EvaluationReport
          evaluation={evaluation}
          report={evaluation.report as unknown as EvaluationReportType}
        />
      ) : (
        <div className="surface-card flex flex-col items-center px-6 py-12 text-center">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h2 className="mt-3 font-bold">尚未生成评测报告</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">提交该项目后，系统会生成安全证据、置信度与采用建议。</p>
          {evaluationSource ? (
            <Link href={evaluationHref} className="button-primary mt-5 h-10 px-5 text-sm">开始评测 {skill.name}</Link>
          ) : (
            <span className="mt-5 text-xs font-semibold text-muted-foreground">该项目暂时没有可验证的公开来源</span>
          )}
        </div>
      )}

      {evaluation && (
        <EvaluationBadge
          badgeUrl={absoluteUrl(`/api/badge/${encodeURIComponent(skill.slug)}`)}
          detailUrl={`${canonicalUrl}?utm_source=github&utm_medium=readme&utm_campaign=evaluation_badge`}
          skillName={skill.name}
        />
      )}

      {trend.length > 0 && (
        <div className="surface-card p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">30 天热度趋势</h2>
          <TrendChart
            data={trend.map((d) => ({
              date: d.date,
              githubStars: d.githubStars ?? 0,
              githubStarsDelta: d.githubStarsDelta ?? 0,
              hotScore: d.hotScore ?? "0",
            }))}
          />
        </div>
      )}

      {/* Tags */}
      {(skill.tags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(skill.tags ?? []).map((tag) => (
            <Link
              key={tag}
              href={`/search?tag=${encodeURIComponent(tag)}`}
            >
              <Badge variant="secondary" className="cursor-pointer hover:bg-primary/10">
                #{tag}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* README */}
      {readme && (
        <div className="surface-card overflow-hidden p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">README</h2>
          <div className="markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, [rehypeSanitize, defaultSchema]]}
              urlTransform={(url, key) => transformReadmeUrl(url, key, {
                repositoryUrl: skill.repoUrl!,
                htmlUrl: readme.htmlUrl,
                rawUrl: readme.rawUrl,
              })}
              components={{
                a: ({ href, children, ...props }) => {
                  const external = Boolean(href && /^https?:\/\//i.test(href));
                  return (
                    <a
                      href={href}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noopener noreferrer" : undefined}
                      {...props}
                    >
                      {children}
                    </a>
                  );
                },
                img: ({ alt, ...props }) => (
                  <img alt={alt ?? "README 图片"} loading="lazy" decoding="async" {...props} />
                ),
              }}
            >
              {readme.content}
            </ReactMarkdown>
          </div>
        </div>
      )}

    </div>
  );
}
