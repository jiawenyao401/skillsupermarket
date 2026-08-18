import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock3, ShieldCheck } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { GUIDES } from "@/lib/guides";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI Skill、MCP 与 Agent 实战指南",
  description: "面向 AI builder 的实战指南：正确区分 Skill、MCP Server 与 Agent Pack，并用可复核证据完成安全评测。",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "AI Skill、MCP 与 Agent 实战指南",
    description: "不是关键词文章，而是可直接执行的选择、评测和安全清单。",
    url: "/guides",
    type: "website",
  },
};

export default function GuidesPage() {
  return (
    <div className="space-y-14 sm:space-y-16">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "AI Skill、MCP 与 Agent 实战指南",
        url: absoluteUrl("/guides"),
        inLanguage: "zh-CN",
        hasPart: GUIDES.map((guide) => ({
          "@type": "Article",
          headline: guide.title,
          url: absoluteUrl(`/guides/${guide.slug}`),
        })),
      }} />

      <section className="relative overflow-hidden rounded-[2rem] border bg-card px-5 py-12 shadow-sm sm:px-10 sm:py-16 lg:px-16">
        <div className="hero-grid" aria-hidden="true" />
        <div className="relative z-10 max-w-3xl">
          <div className="section-eyebrow flex items-center gap-2"><BookOpen className="h-4 w-4" /> Builder guides</div>
          <h1 className="mt-4 text-balance text-4xl font-black leading-[1.08] tracking-[-0.05em] sm:text-5xl">选择和评测 AI 能力，先看证据</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">围绕真实使用决策整理的指南。每篇都给出可执行检查项、明确边界和一手资料来源，并能直接进入公开评测。</p>
        </div>
      </section>

      <section>
        <div className="grid gap-5 lg:grid-cols-3">
          {GUIDES.map((guide) => (
            <article key={guide.slug} className="surface-card flex min-h-[25rem] flex-col p-6 sm:p-7">
              <div className="section-eyebrow">{guide.eyebrow}</div>
              <h2 className="mt-4 text-2xl font-extrabold leading-tight tracking-[-0.035em]">{guide.title}</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{guide.description}</p>
              <p className="mt-4 rounded-xl bg-muted/60 p-4 text-xs leading-5 text-muted-foreground">{guide.intent}</p>
              <div className="mt-auto flex items-center justify-between gap-3 pt-7">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> {guide.readingMinutes} 分钟</span>
                <Link href={`/guides/${guide.slug}`} className="inline-flex items-center gap-1 text-sm font-bold hover:text-primary">阅读指南 <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] bg-foreground px-6 py-10 text-background sm:px-10 sm:py-12">
        <div className="grid items-center gap-7 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><ShieldCheck className="h-4 w-4" /> Evidence first</div>
            <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">已经有具体项目？直接生成证据报告</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-background/60 sm:text-base">支持公开 GitHub 仓库、npm 与 PyPI。登录用户每周可免费发起 10 次新评测。</p>
          </div>
          <Link href="/evaluate" className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-white transition hover:bg-primary/90">开始评测 <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </div>
      </section>
    </div>
  );
}
