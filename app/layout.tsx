import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    default: "Skill Supermarket - AI 技能超市",
    template: "%s · Skill Supermarket",
  },
  description:
    "发现、评测、跟踪 Claude Skills / MCP Servers / Agent Packs。每天看最火的 AI 技能。",
  keywords: ["Claude", "MCP", "Skill", "AI", "Agent", "评测"],
  authors: [{ name: "Skill Supermarket" }],
  openGraph: {
    title: "Skill Supermarket",
    description: "AI 技能超市 - 发现、评测、跟踪",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <span className="text-2xl">🛒</span>
              <span>Skill Supermarket</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/" className="hover:text-primary">首页</Link>
              <Link href="/category/programming" className="hover:text-primary">编程</Link>
              <Link href="/category/data" className="hover:text-primary">数据</Link>
              <Link href="/category/design" className="hover:text-primary">设计</Link>
              <Link href="/category/productivity" className="hover:text-primary">办公</Link>
              <Link href="/evaluate" className="hover:text-primary">评测</Link>
              <Link
                href="https://github.com/jiawenyao401/skillsupermarket"
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary"
              >
                GitHub ↗
              </Link>
            </nav>
          </div>
        </header>
        <main className="container py-6">{children}</main>
        <footer className="border-t mt-12 py-6">
          <div className="container text-sm text-muted-foreground flex justify-between">
            <div>© {new Date().getFullYear()} Skill Supermarket</div>
            <div className="flex gap-4">
              <Link href="/about" className="hover:text-primary">关于</Link>
              <Link href="/docs" className="hover:text-primary">文档</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
