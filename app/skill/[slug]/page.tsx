import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { skills, evaluations, metricsDaily } from "@/lib/schema";
import { eq, desc, and, gte, asc } from "drizzle-orm";
import { EvaluationRadar } from "@/components/EvaluationRadar";
import { TrendChart } from "@/components/TrendChart";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatNumber, relativeTime } from "@/lib/utils";
import { ExternalLink, Github, Star, GitFork, Download, Calendar, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getReadme } from "@/lib/github";
import Link from "next/link";

interface PageProps {
  params: { slug: string };
}

export const dynamic = "force-dynamic";
export const revalidate = 3600;

async function getSkill(slug: string) {
  const [skill] = await db
    .select()
    .from(skills)
    .where(eq(skills.slug, slug));
  if (!skill) return null;

  const [evaluation] = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.skillId, skill.id))
    .orderBy(desc(evaluations.evaluatedAt))
    .limit(1);

  // 最近 30 天热度趋势
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().split("T")[0];

  const trend = await db
    .select()
    .from(metricsDaily)
    .where(
      and(
        eq(metricsDaily.skillId, skill.id),
        gte(metricsDaily.date, sinceStr)
      )
    )
    .orderBy(asc(metricsDaily.date));

  return { skill, evaluation, trend };
}

export default async function SkillDetailPage({ params }: PageProps) {
  const data = await getSkill(params.slug);
  if (!data) notFound();

  const { skill, evaluation, trend } = data;
  let readme: string | null = null;
  if (skill.repoUrl) {
    const match = skill.repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    if (match) readme = await getReadme(match[1]);
  }

  const typeLabel = {
    "claude-skill": "Claude Skill",
    "mcp-server": "MCP Server",
    "agent-pack": "Agent Pack",
  }[skill.type];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="default">{typeLabel}</Badge>
              {skill.category && <Badge variant="secondary">{skill.category}</Badge>}
              {skill.license && <Badge variant="outline">{skill.license}</Badge>}
              {skill.currentVersion && (
                <Badge variant="outline">v{skill.currentVersion}</Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold">{skill.name}</h1>
            {skill.description && (
              <p className="mt-2 text-muted-foreground max-w-2xl">{skill.description}</p>
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

          <div className="flex flex-col gap-2">
            {skill.repoUrl && (
              <Button asChild>
                <a href={skill.repoUrl} target="_blank" rel="noreferrer">
                  <Github className="w-4 h-4 mr-2" />
                  GitHub <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
            )}
            {skill.packageUrl && (
              <Button variant="outline" asChild>
                <a href={skill.packageUrl} target="_blank" rel="noreferrer">
                  <Download className="w-4 h-4 mr-2" />
                  Package <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-6 text-sm">
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

      {/* 评测 + 趋势 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {evaluation && (() => {
          const report = evaluation.report as unknown as import("@/lib/types").EvaluationReport;
          return (
          <div className="rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">📊 评测报告</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl font-bold text-primary">
                {evaluation.overallScore}
              </div>
              <div className="text-sm text-muted-foreground">
                <div>综合评分</div>
                <div>更新于 {relativeTime(evaluation.evaluatedAt)}</div>
              </div>
            </div>
            <EvaluationRadar evaluation={evaluation} />
            <div className="mt-4 text-xs text-muted-foreground">
              {report.documentation.details} ·{" "}
              {report.security.details} ·{" "}
              {report.activity.details}
            </div>
            {report.quality.llmComment && (
              <div className="mt-3 p-3 bg-muted rounded text-sm">
                💬 {report.quality.llmComment}
              </div>
            )}
          </div>
          );
        })()}

        {trend.length > 0 && (
          <div className="rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">📈 30 天热度趋势</h2>
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
      </div>

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
        <div className="rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">📖 README</h2>
          <div className="markdown">
            <ReactMarkdown>{readme}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* 安全发现 */}
      {evaluation && (() => {
        const report = evaluation.report as unknown as import("@/lib/types").EvaluationReport;
        const findings = report.security?.findings ?? [];
        return findings.length > 0 ? (
          <div className="rounded-lg border p-6 border-destructive/30">
            <h2 className="text-lg font-semibold mb-4">⚠️ 安全发现</h2>
            <ul className="space-y-2 text-sm">
              {findings.map((f, i) => (
                <li
                  key={i}
                  className={`p-2 rounded ${
                    f.level === "danger"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
                  }`}
                >
                  <span className="font-mono text-xs mr-2">{f.type}</span>
                  {f.message}
                  {f.location && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({f.location})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null;
      })()}
    </div>
  );
}
