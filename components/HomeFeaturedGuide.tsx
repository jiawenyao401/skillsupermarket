import Link from "next/link";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import type { Guide } from "@/lib/guides";

export function HomeFeaturedGuide({ guide }: { guide: Pick<Guide, "slug" | "title" | "description" | "readingMinutes"> }) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-card px-6 py-8 sm:px-9 sm:py-10" aria-labelledby="home-featured-guide-title">
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
      <div className="relative grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 max-w-3xl">
          <div className="section-eyebrow flex items-center gap-2"><BookOpenCheck className="h-4 w-4" /> 2026 现行入口指南</div>
          <h2 id="home-featured-guide-title" className="mt-3 text-balance text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">你搜到的 OpenAI Skills，可能已经是旧入口</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">{guide.description}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-foreground/70" aria-label="指南涵盖内容">
            {["Codex → OpenAI Plugins", "Claude → Agent Skills", "共同格式 → SKILL.md"].map((label) => (
              <span key={label} className="rounded-full border bg-background px-3 py-1.5">{label}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <Link href={`/guides/${guide.slug}`} className="inline-flex min-h-12 items-center justify-center rounded-full bg-foreground px-6 text-sm font-bold text-background transition hover:bg-foreground/85">
            查看现行入口对比 <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
          <span className="text-xs text-muted-foreground">约 {guide.readingMinutes} 分钟 · 含真实报告与迁移检查</span>
        </div>
      </div>
    </section>
  );
}
