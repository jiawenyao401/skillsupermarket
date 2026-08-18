import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Github,
  Menu,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Suspense } from "react";
import { AuthNav } from "@/components/AuthNav";
import { AdminMobileNavLink } from "@/components/AdminMobileNavLink";
import { JsonLd } from "@/components/JsonLd";
import { TrafficTracker } from "@/components/TrafficTracker";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Skill Supermarket — AI 能力发现与评测",
    template: "%s · Skill Supermarket",
  },
  description:
    "发现经过评测的 AI Skills、MCP Servers 与 Agent Packs，用可信数据为你的 AI 选择下一项能力。",
  keywords: ["Claude", "MCP", "AI Skill", "Agent", "AI 工具", "安全评测"],
  authors: [{ name: "Skill Supermarket" }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  applicationName: SITE_NAME,
  category: "technology",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "Skill Supermarket — AI 能力发现与评测",
    description: "发现、比较并评测真正值得使用的 AI 能力。",
    type: "website",
    url: "/",
    locale: "zh_CN",
    siteName: "Skill Supermarket",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skill Supermarket — AI 能力发现与评测",
    description: "发现、比较并评测真正值得使用的 AI 能力。",
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  other: process.env.BAIDU_SITE_VERIFICATION
    ? { "baidu-site-verification": process.env.BAIDU_SITE_VERIFICATION }
    : undefined,
};

const categories = [
  ["编程", "/category/programming"],
  ["数据", "/category/data"],
  ["设计", "/category/design"],
  ["效率", "/category/productivity"],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Suspense fallback={null}><TrafficTracker /></Suspense>
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": absoluteUrl("/#organization"),
              name: SITE_NAME,
              url: SITE_URL,
              logo: absoluteUrl("/brand-icon.png"),
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": absoluteUrl("/#website"),
              name: SITE_NAME,
              url: SITE_URL,
              publisher: { "@id": absoluteUrl("/#organization") },
              inLanguage: "zh-CN",
              potentialAction: {
                "@type": "SearchAction",
                target: `${absoluteUrl("/search")}?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            },
          ]}
        />
        <a
          href="#main-content"
          className="sr-only z-[100] rounded-md bg-foreground px-4 py-2 text-background focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          跳到主要内容
        </a>

        <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/85 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between gap-4">
            <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="Skill Supermarket 首页">
              <span className="brand-mark" aria-hidden="true">
                <Image
                  src="/brand-icon.png"
                  alt=""
                  width={36}
                  height={36}
                  className="h-full w-full rounded-[inherit]"
                  priority
                />
              </span>
              <span className="text-[15px] font-extrabold tracking-[-0.02em] sm:text-base">
                Skill <span className="text-primary">Supermarket</span>
              </span>
            </Link>

            <nav className="hidden items-center gap-1 text-sm font-medium md:flex" aria-label="主导航">
              <Link href="/" className="nav-link">发现</Link>
              {categories.map(([label, href]) => (
                <Link key={href} href={href} className="nav-link">{label}</Link>
              ))}
              <Link href="/evaluation" className="nav-link">评测</Link>
              <Link href="/guides" className="nav-link">指南</Link>
              <Link href="/account" className="nav-link">个人中心</Link>
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href="/search"
                className="hidden h-9 items-center gap-2 rounded-full border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground sm:flex"
              >
                <Search className="h-3.5 w-3.5" />
                搜索
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans text-[10px]">⌘ K</kbd>
              </Link>
              <Link href="/evaluate" className="button-primary h-9 px-3 text-xs sm:px-4 sm:text-sm">
                提交评测
              </Link>
              <Suspense fallback={<span className="hidden h-9 w-16 animate-pulse rounded-full bg-muted sm:block" />}>
                <AuthNav />
              </Suspense>

              <details className="mobile-menu relative md:hidden">
                <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border bg-card [&::-webkit-details-marker]:hidden" aria-label="打开导航菜单">
                  <Menu className="h-4 w-4" />
                </summary>
                <div className="absolute right-0 top-12 w-64 rounded-2xl border bg-card p-2 shadow-xl shadow-black/10">
                  <Link href="/search" className="mobile-nav-link"><Search className="h-4 w-4" />搜索全部技能</Link>
                  <Link href="/" className="mobile-nav-link">发现</Link>
                  {categories.map(([label, href]) => (
                    <Link key={href} href={href} className="mobile-nav-link">{label}</Link>
                  ))}
                  <Link href="/evaluation" className="mobile-nav-link"><ShieldCheck className="h-4 w-4" />了解评测服务</Link>
                  <Link href="/guides" className="mobile-nav-link">实战指南</Link>
                  <Link href="/evaluate" className="mobile-nav-link"><ShieldCheck className="h-4 w-4" />提交评测</Link>
                  <Link href="/account" className="mobile-nav-link">个人中心</Link>
                  <Suspense fallback={null}><AdminMobileNavLink /></Suspense>
                  <Link href="/login?returnTo=%2Fevaluate" className="mobile-nav-link">登录 / 注册</Link>
                </div>
              </details>
            </div>
          </div>
        </header>

        <main id="main-content" className="container py-8 sm:py-10">{children}</main>

        <footer className="mt-20 border-t bg-card/50">
          <div className="container grid gap-10 py-10 md:grid-cols-[1.2fr_1fr_1fr]">
            <div className="max-w-sm">
              <Link href="/" className="flex items-center gap-2 font-bold">
                <span className="brand-mark brand-mark-small" aria-hidden="true">
                  <Image
                    src="/brand-icon.png"
                    alt=""
                    width={28}
                    height={28}
                    className="h-full w-full rounded-[inherit]"
                  />
                </span>
                Skill Supermarket
              </Link>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                一个开放、透明的 AI 能力索引。用真实数据与安全评测，帮你更快找到值得信任的 Skill、MCP 与 Agent。
              </p>
            </div>
            <div>
              <div className="footer-title">探索</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                {categories.map(([label, href]) => <Link key={href} href={href} className="footer-link">{label}</Link>)}
                <Link href="/search" className="footer-link">全部技能</Link>
                <Link href="/evaluation" className="footer-link">评测服务</Link>
                <Link href="/guides" className="footer-link">实战指南</Link>
                <Link href="/evaluate" className="footer-link">提交评测</Link>
              </div>
            </div>
            <div>
              <div className="footer-title">项目</div>
              <a
                href="https://github.com/jiawenyao401/skillsupermarket"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Github className="h-4 w-4" /> GitHub <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <p className="mt-5 text-xs text-muted-foreground">数据持续更新 · 评分过程透明</p>
            </div>
          </div>
          <div className="border-t">
            <div className="container flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>© {new Date().getFullYear()} Skill Supermarket</span>
              <span className="flex items-center gap-3"><Link href="/privacy" className="hover:text-foreground">隐私说明</Link><span>为 AI builder 构建 · 开源项目</span></span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
