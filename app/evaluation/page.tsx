import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Braces,
  Check,
  FileSearch,
  Gauge,
  Github,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { and, desc, eq, sql } from "drizzle-orm";
import { JsonLd } from "@/components/JsonLd";
import { SkillCard } from "@/components/SkillCard";
import { db } from "@/lib/db";
import { evaluations, skills } from "@/lib/schema";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Skill、MCP 与 Agent 安全评测",
  description:
    "基于真实仓库证据、静态安全扫描与 AI 复核，评测 AI Skill、MCP Server 和 Agent Pack 的文档、安全、工程质量、活跃度与采用度。",
  alternates: { canonical: "/evaluation" },
  openGraph: {
    title: "AI Skill、MCP 与 Agent 安全评测",
    description: "公开方法、真实证据与可复核报告，帮助你判断一个 AI 能力是否值得采用。",
    url: "/evaluation",
    type: "website",
  },
};

const DIMENSIONS = [
  ["文档完整度", "22%", "安装、示例、参数、限制与错误处理"],
  ["安全性", "25%", "提示注入、凭证、危险 API 与供应链模式"],
  ["工程质量", "30%", "实用性、清晰度、复用性与项目设计"],
  ["活跃度", "13%", "维护新鲜度、提交与问题积压信号"],
  ["采用度", "10%", "Stars、下载、Fork 与近期增长"],
] as const;

const STEPS = [
  {
    icon: FileSearch,
    title: "采集公开证据",
    description: "读取项目元数据、README、SKILL.md 和高信号清单文件。",
  },
  {
    icon: ShieldCheck,
    title: "执行静态安全扫描",
    description: "识别提示注入、泄露凭证、命令执行与供应链风险模式。",
  },
  {
    icon: Gauge,
    title: "生成五维评分",
    description: "确定性检查为主，AI Judge 只做保守、结构化的质量复核。",
  },
  {
    icon: LockKeyhole,
    title: "发布可复核报告",
    description: "公开结论、风险证据、置信度、局限与可执行改进建议。",
  },
] as const;

const FAQ = [
  {
    question: "评测会安装或执行项目代码吗？",
    answer: "不会。当前系统只读取公开元数据与高信号文本文件并执行静态检查，不克隆执行项目代码。静态评测不能替代人工安全审计。",
  },
  {
    question: "Skill、MCP Server 和 Agent Pack 使用同一套结论吗？",
    answer: "评分维度一致，报告会保留项目类型并依据实际证据解释结论。MCP 项目不会因为名称被宣称已通过协议兼容性测试。",
  },
  {
    question: "免费账户可以评测多少次？",
    answer: "登录用户每周可发起 10 次新评测。查看公开报告或命中仍然有效的缓存报告不重复消耗额度。",
  },
  {
    question: "支持哪些项目来源？",
    answer: "目前支持公开 GitHub 仓库、npm 包和 PyPI 包。系统会验证来源并只使用能够取得的公开证据。",
  },
] as const;

async function getEvaluationData() {
  try {
    const latestEvaluations = db
      .selectDistinctOn([evaluations.skillId], {
        skillId: evaluations.skillId,
        overallScore: evaluations.overallScore,
        evaluationId: evaluations.id,
      })
      .from(evaluations)
      .orderBy(evaluations.skillId, desc(evaluations.evaluatedAt))
      .as("public_latest_evaluations");

    const [stats, cases] = await Promise.all([
      db
        .select({ evaluatedSkills: sql<number>`COUNT(DISTINCT ${evaluations.skillId})::int` })
        .from(evaluations),
      db
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
          evaluatedAt: evaluations.evaluatedAt,
        })
        .from(skills)
        .innerJoin(latestEvaluations, eq(skills.id, latestEvaluations.skillId))
        .innerJoin(evaluations, eq(evaluations.id, latestEvaluations.evaluationId))
        .where(and(eq(skills.status, "active"), sql`${evaluations.report} IS NOT NULL`))
        .orderBy(desc(evaluations.evaluatedAt))
        .limit(6),
    ]);

    return { evaluatedSkills: stats[0]?.evaluatedSkills ?? 0, cases };
  } catch (error) {
    console.error("[evaluation] 无法读取公开评测案例", error);
    return { evaluatedSkills: 0, cases: [] };
  }
}

export default async function EvaluationLandingPage() {
  const { evaluatedSkills, cases } = await getEvaluationData();

  return (
    <div className="space-y-20 sm:space-y-24">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "AI Skill、MCP 与 Agent 安全评测",
            url: absoluteUrl("/evaluation"),
            description: "基于公开仓库证据、静态安全扫描和结构化 AI 复核的五维评测服务。",
            provider: { "@type": "Organization", "@id": absoluteUrl("/#organization") },
            areaServed: "Worldwide",
            serviceType: "AI software evaluation",
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map(({ question, answer }) => ({
              "@type": "Question",
              name: question,
              acceptedAnswer: { "@type": "Answer", text: answer },
            })),
          },
        ]}
      />

      <section className="relative overflow-hidden rounded-[2rem] border bg-card px-5 py-12 shadow-sm sm:px-10 sm:py-16 lg:px-16 lg:py-20">
        <div className="hero-grid" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="section-eyebrow flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Evidence-based evaluation
          </div>
          <h1 className="mt-4 text-balance text-4xl font-black leading-[1.06] tracking-[-0.055em] sm:text-6xl">
            看清一个 AI 能力，<span className="hero-highlight">值不值得采用</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            面向 AI Skills、MCP Servers 与 Agent Packs 的公开评测。每个分数都连接到真实证据、风险说明与改进建议。
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/evaluate" className="button-primary h-12 px-6 text-sm">
              免费开始评测 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="/search?sort=score" className="inline-flex h-12 items-center rounded-full border bg-background px-6 text-sm font-semibold transition hover:border-primary/40">
              查看真实评分榜
            </Link>
          </div>
          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 divide-x rounded-2xl border bg-background/75 py-4 shadow-sm backdrop-blur">
            <div className="px-2 sm:px-5">
              <div className="text-xl font-extrabold tracking-tight">{evaluatedSkills}</div>
              <div className="mt-1 text-[10px] text-muted-foreground sm:text-xs">已有公开报告</div>
            </div>
            <div className="px-2 sm:px-5">
              <div className="text-xl font-extrabold tracking-tight">5</div>
              <div className="mt-1 text-[10px] text-muted-foreground sm:text-xs">公开评分维度</div>
            </div>
            <div className="px-2 sm:px-5">
              <div className="text-xl font-extrabold tracking-tight">10</div>
              <div className="mt-1 text-[10px] text-muted-foreground sm:text-xs">每周免费次数</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl text-center">
          <div className="section-eyebrow">How it works</div>
          <h2 className="section-title mt-2">从公开项目到可复核结论</h2>
          <p className="section-description mx-auto">只评估系统真正取得的证据，并把自动化结论的边界一并写进报告。</p>
        </div>
        <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, description }, index) => (
            <li key={title} className="surface-card p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                <span className="font-mono text-xs font-bold text-muted-foreground">0{index + 1}</span>
              </div>
              <h3 className="mt-5 font-extrabold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-[2rem] bg-foreground px-5 py-10 text-background sm:px-8 sm:py-12">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Transparent methodology</div>
            <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">权重公开，安全风险有硬上限</h2>
            <p className="mt-2 text-sm leading-6 text-background/60 sm:text-base">流行度不会掩盖严重风险。静态扫描的局限和 AI 是否实际参与复核，也会随报告公开。</p>
          </div>
          <div className="flex gap-2 text-background/70">
            <Sparkles className="h-5 w-5" aria-label="Skill" />
            <Braces className="h-5 w-5" aria-label="MCP Server" />
            <Bot className="h-5 w-5" aria-label="Agent Pack" />
          </div>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {DIMENSIONS.map(([dimension, weight, detail], index) => (
            <div key={dimension} className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-primary">0{index + 1}</span><span className="font-mono text-xs text-background/45">{weight}</span></div>
              <div className="mt-3 text-sm font-semibold">{dimension}</div>
              <div className="mt-1.5 text-xs leading-5 text-background/45">{detail}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="section-eyebrow flex items-center gap-2"><Github className="h-4 w-4" /> Real reports</div>
            <h2 className="section-title mt-2">不是演示数据，直接查看真实报告</h2>
            <p className="section-description">案例来自当前公开项目和已经完成的正式评测，不使用虚构分数。</p>
          </div>
          <Link href="/search?sort=score" className="inline-flex items-center gap-1 text-sm font-semibold hover:text-primary">全部评分 <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {cases.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cases.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={{
                  ...skill,
                  tags: skill.tags ?? [],
                  firstSeenAt: skill.firstSeenAt ?? new Date(),
                  githubStars: skill.githubStars ?? 0,
                }}
                score={skill.overallScore}
              />
            ))}
          </div>
        ) : (
          <div className="surface-card px-6 py-10 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
            <h3 className="mt-3 font-bold">首批公开报告正在生成</h3>
            <p className="mt-1 text-sm text-muted-foreground">你可以提交一个公开项目，成为首批可复核案例。</p>
          </div>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <div className="section-eyebrow">Questions & boundaries</div>
          <h2 className="section-title mt-2">评测前，你应该知道</h2>
          <p className="section-description">自动评测用于降低初筛成本，不替代代码审计、渗透测试或生产环境验证。</p>
        </div>
        <div className="space-y-3">
          {FAQ.map(({ question, answer }) => (
            <details key={question} className="group surface-card p-5 open:border-primary/30">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
                {question}<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 pr-8 text-sm leading-6 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] border bg-card px-6 py-10 sm:px-10 sm:py-12">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <div className="section-eyebrow flex items-center gap-2"><Check className="h-4 w-4" /> Free weekly quota</div>
            <h2 className="section-title mt-2">用一份真实报告，替代一次盲选</h2>
            <p className="section-description">登录后每周可发起 10 次新评测；报告公开可查，评分方法和自动化边界透明。</p>
          </div>
          <Link href="/evaluate" className="button-primary h-12 px-6 text-sm">开始免费评测 <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </div>
      </section>
    </div>
  );
}
