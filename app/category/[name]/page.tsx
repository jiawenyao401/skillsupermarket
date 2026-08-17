import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Code2, Database, Palette, Sparkles, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { skills } from "@/lib/schema";
import { eq, desc, and } from "drizzle-orm";
import { SkillCard } from "@/components/SkillCard";
import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl } from "@/lib/site";

const CATEGORIES = {
  programming: { label: "开发与代码", description: "从代码生成到调试、测试和仓库自动化，为工程工作流增加可靠的 AI 能力。", icon: Code2, accent: "bg-sky-500/10 text-sky-700" },
  data: { label: "数据与知识", description: "连接数据库、查询知识、构建 ETL，让 AI 能读取、理解并使用你的数据。", icon: Database, accent: "bg-violet-500/10 text-violet-700" },
  design: { label: "设计与创意", description: "覆盖 UI/UX、图像生成和内容创作，把灵感更快变成可以使用的作品。", icon: Palette, accent: "bg-pink-500/10 text-pink-700" },
  productivity: { label: "效率与办公", description: "串联文档、邮件、笔记与协作工具，减少日常工作中的重复操作。", icon: Zap, accent: "bg-amber-500/10 text-amber-700" },
  other: { label: "更多能力", description: "探索尚未归入常用场景、但同样值得关注的新型 AI 能力。", icon: Sparkles, accent: "bg-primary/10 text-primary" },
} as const;

interface PageProps { params: Promise<{ name: string }>; }

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { name } = await params;
  const cat = CATEGORIES[name as keyof typeof CATEGORIES];
  if (!cat) return { title: "分类不存在", robots: { index: false, follow: false } };

  const canonical = `/category/${name}`;
  const title = `${cat.label} AI Skills 与 MCP 工具`;
  return {
    title,
    description: cat.description,
    alternates: { canonical },
    openGraph: { title, description: cat.description, url: canonical, type: "website" },
    twitter: { card: "summary_large_image", title, description: cat.description },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { name } = await params;
  const cat = CATEGORIES[name as keyof typeof CATEGORIES];
  if (!cat) notFound();

  const list = await db
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
    .where(and(eq(skills.category, name), eq(skills.status, "active")))
    .orderBy(desc(skills.githubStars))
    .limit(50);

  const Icon = cat.icon;

  return (
    <div className="space-y-8">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "首页", item: absoluteUrl("/") },
              { "@type": "ListItem", position: 2, name: cat.label, item: absoluteUrl(`/category/${name}`) },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `${cat.label} AI 能力`,
            numberOfItems: list.length,
            itemListElement: list.map((skill, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: skill.name,
              url: absoluteUrl(`/skill/${encodeURIComponent(skill.slug)}`),
            })),
          },
        ]}
      />
      <section className="relative overflow-hidden rounded-[2rem] border bg-card px-6 py-10 sm:px-10 sm:py-12">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${cat.accent}`}><Icon className="h-6 w-6" /></span>
          <h1 className="mt-6 text-3xl font-black tracking-[-0.04em] sm:text-5xl">{cat.label}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{cat.description}</p>
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><span className="font-bold text-foreground">{list.length}</span> 个已收录项目</div>
        </div>
      </section>

      {list.length === 0 ? (
        <div className="surface-card flex flex-col items-center px-6 py-16 text-center">
          <Sparkles className="h-8 w-8 text-primary" />
          <h2 className="mt-4 text-lg font-bold">这个分类还在补货</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">如果你知道值得收录的项目，可以提交地址并触发自动评测。</p>
          <Link href="/evaluate" className="button-primary mt-5 h-10 px-5 text-sm">提交第一个项目 <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={{ ...skill, tags: skill.tags ?? [], firstSeenAt: skill.firstSeenAt ?? new Date(), githubStars: skill.githubStars ?? 0 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
