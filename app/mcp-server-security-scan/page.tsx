import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Braces,
  CheckCircle2,
  FileCode2,
  GitCompareArrows,
  LockKeyhole,
  Network,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "MCP Server 安全评测与静态扫描",
  description:
    "提交公开 GitHub、npm 或 PyPI MCP Server，检查提示注入、凭证、危险执行与供应链模式，生成带证据、置信度和改进建议的公开报告。",
  alternates: { canonical: "/mcp-server-security-scan" },
  openGraph: {
    title: "MCP Server 安全评测与静态扫描",
    description: "不安装、不执行项目代码，用公开证据完成 MCP Server 安全与质量评测。",
    url: "/mcp-server-security-scan",
    type: "website",
  },
};

const CHECKS = [
  {
    icon: ShieldAlert,
    title: "危险模式",
    description: "识别提示注入、凭证痕迹、动态代码执行、子进程调用和隐藏下载执行等高风险信号。",
  },
  {
    icon: FileCode2,
    title: "公开证据",
    description: "核对 README、清单文件、安装与使用示例，只对系统实际取得的内容作结论。",
  },
  {
    icon: Braces,
    title: "工程与维护",
    description: "结合项目结构、文档、活跃度和采用信号，区分可维护能力与营销声明。",
  },
  {
    icon: Network,
    title: "可解释报告",
    description: "展示五维得分、风险证据、置信度、行动建议，并在证据充分时生成流程图、时序图或架构图。",
  },
] as const;

const METHODS = [
  {
    title: "人工代码审计",
    fit: "高风险上线前",
    coverage: "最深入，但依赖审计范围、人员与时间",
    featured: false,
  },
  {
    title: "本站静态证据评测",
    fit: "接入前筛选与持续复评",
    coverage: "快速、可复核，不安装或执行项目代码",
    featured: true,
  },
  {
    title: "运行时 / 协议测试",
    fit: "兼容性与真实行为验证",
    coverage: "验证连接和副作用，需要隔离环境与明确授权",
    featured: false,
  },
] as const;

const FAQ = [
  {
    question: "扫描会安装或运行 MCP Server 吗？",
    answer: "不会。当前评测只读取可公开取得的元数据和高信号文本文件，不克隆执行项目代码，也不会连接 MCP Server。",
  },
  {
    question: "报告能证明 MCP 协议兼容或没有漏洞吗？",
    answer: "不能。报告反映静态证据与已知风险模式，不证明协议兼容、运行时安全或不存在未知漏洞，也不能替代渗透测试和人工代码审计。",
  },
  {
    question: "支持哪些来源？",
    answer: "目前支持公开 GitHub 仓库、npm 包和 PyPI 包。无法公开读取或证据不足的项目会降低置信度，而不是补造结论。",
  },
  {
    question: "评测结果为什么可能发生变化？",
    answer: "项目代码、公开元数据、活跃度以及评测算法版本都会变化。报告会保留评测时间和证据，便于后续复评。",
  },
] as const;

export default function McpServerSecurityScanPage() {
  return (
    <div className="space-y-16 sm:space-y-20">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "MCP Server 安全评测与静态扫描",
            url: absoluteUrl("/mcp-server-security-scan"),
            description: "基于公开项目证据的 MCP Server 静态安全与质量评测服务。",
            provider: { "@type": "Organization", "@id": absoluteUrl("/#organization") },
            serviceType: "MCP Server security evaluation",
            areaServed: "Worldwide",
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "首页", item: absoluteUrl("/") },
              { "@type": "ListItem", position: 2, name: "MCP Server 安全评测", item: absoluteUrl("/mcp-server-security-scan") },
            ],
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
        <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="section-eyebrow flex items-center gap-2">
              <ScanSearch className="h-4 w-4" /> MCP security evaluator
            </div>
            <h1 className="mt-4 text-balance text-4xl font-black leading-[1.06] tracking-[-0.055em] sm:text-6xl">
              接入 MCP Server 前，<span className="hero-highlight">先看真实证据</span>
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              提交公开 GitHub、npm 或 PyPI 项目，检查提示注入、凭证、危险执行与供应链模式，生成带置信度和改进建议的可复核报告。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/evaluate" className="button-primary h-12 px-6 text-sm">
                免费开始评测 <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/skill/githubgithub-mcp-server"
                className="inline-flex h-12 items-center justify-center rounded-full border bg-background px-6 text-sm font-semibold transition hover:border-primary/40"
              >
                查看真实 MCP 报告
              </Link>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              登录用户每周可免费发起 10 次新评测；查看有效缓存报告不重复消耗额度。
            </p>
          </div>

          <div className="rounded-2xl border bg-background/85 p-5 shadow-sm backdrop-blur sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-extrabold"><ShieldCheck className="h-5 w-5 text-primary" /> 扫描边界</div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">Static only</span>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
              {[
                "不安装、不执行、不连接目标服务",
                "不把流行度当作安全证明",
                "不宣称已完成协议兼容性测试",
                "证据不足时降低置信度，不补造结论",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl text-center">
          <div className="section-eyebrow">What gets checked</div>
          <h2 className="section-title mt-2">四类证据，一份可行动报告</h2>
          <p className="section-description mx-auto">自动化负责扩大覆盖，严重风险有硬上限，AI Judge 只对已有证据做保守复核。</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {CHECKS.map(({ icon: Icon, title, description }) => (
            <article key={title} className="surface-card p-6 sm:p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] bg-foreground px-5 py-10 text-background sm:px-8 sm:py-12">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><GitCompareArrows className="h-4 w-4" /> Choose the right method</div>
          <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">静态评测适合筛选，不替代运行时验证</h2>
          <p className="mt-2 text-sm leading-6 text-background/60 sm:text-base">不同方法回答不同问题。把自动化报告当作接入决策的证据入口，而不是“绝对安全”证书。</p>
        </div>
        <div className="mt-7 grid gap-3 lg:grid-cols-3">
          {METHODS.map((method) => (
            <article key={method.title} className={`rounded-xl border p-5 ${method.featured ? "border-primary/60 bg-primary/10" : "border-white/10 bg-white/[0.06]"}`}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold">{method.title}</h3>
                {method.featured ? <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">本站</span> : null}
              </div>
              <p className="mt-3 text-xs font-semibold text-primary">适合：{method.fit}</p>
              <p className="mt-2 text-sm leading-6 text-background/55">{method.coverage}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <div className="section-eyebrow flex items-center gap-2"><LockKeyhole className="h-4 w-4" /> Clear limits</div>
          <h2 className="section-title mt-2">评测能回答什么，不能回答什么</h2>
          <p className="section-description">边界本身也是结论的一部分。生产环境仍应结合最小权限、隔离、人工审计与运行时测试。</p>
          <Link href="/guides/mcp-server-security-checklist-2026" className="mt-5 inline-flex items-center gap-1 text-sm font-bold hover:text-primary">
            阅读完整 MCP 安全清单 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="divide-y rounded-2xl border bg-card px-5 sm:px-7">
          {FAQ.map(({ question, answer }) => (
            <details key={question} className="group py-5">
              <summary className="cursor-pointer list-none pr-8 text-sm font-bold marker:hidden">{question}</summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border bg-card px-6 py-10 text-center shadow-sm sm:px-10 sm:py-12">
        <h2 className="text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">已有 MCP Server？现在生成证据报告</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">提交公开项目链接。系统会复用仍然有效的报告，并把新评测排入后台队列。</p>
        <Link href="/evaluate" className="button-primary mt-6 h-12 px-6 text-sm">开始免费评测 <ArrowRight className="ml-2 h-4 w-4" /></Link>
      </section>
    </div>
  );
}
