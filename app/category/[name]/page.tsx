import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { skills } from "@/lib/schema";
import { eq, desc, and } from "drizzle-orm";
import { SkillCard } from "@/components/SkillCard";

const CATEGORIES: Record<string, { name: string; label: string; description: string }> = {
  programming: { name: "programming", label: "编程", description: "代码辅助、调试、重构、测试等" },
  data: { name: "data", label: "数据", description: "数据分析、ETL、查询、可视化" },
  design: { name: "design", label: "设计", description: "UI/UX、图像生成、设计辅助" },
  productivity: { name: "productivity", label: "办公", description: "文档、邮件、笔记、效率工具" },
  other: { name: "other", label: "其他", description: "其他类别" },
};

interface PageProps {
  params: { name: string };
}

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: PageProps) {
  const cat = CATEGORIES[params.name];
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
    .where(and(eq(skills.category, cat.name), eq(skills.status, "active")))
    .orderBy(desc(skills.githubStars))
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{cat.label}</h1>
        <p className="text-muted-foreground mt-1">{cat.description}</p>
        <p className="text-sm text-muted-foreground mt-2">共 {list.length} 个技能</p>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          还没有收录该类别的技能
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((skill) => (
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
      )}
    </div>
  );
}
