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
  programming: {
    label: "开发与代码",
    description: "从代码生成到调试、测试和仓库自动化，按证据选择能进入真实工程工作流的 AI Skills 与 MCP 工具。",
    intro: [
      "开发类 AI 能力不应只看演示效果。真正影响生产可用性的，是它能否理解仓库上下文、约束修改范围、运行测试并在失败时给出可恢复的结果。涉及 Shell、文件系统、Git 或部署权限时，还要确认每一步是否可审计、可确认、可回滚。",
      "本分类把文档完整度、安全扫描、工程质量、维护活跃度与采用信号拆开呈现。选择时先从你的任务边界出发：只需要代码建议，还是允许工具直接修改仓库、执行命令或触发发布；权限越高，越需要查看报告中的证据位置与风险说明。",
    ],
    criteria: ["确认支持的语言、框架、仓库规模与测试方式", "核对文件、Shell、网络和部署权限是否最小化", "优先选择有失败处理、变更预览与持续维护证据的项目"],
    icon: Code2,
    accent: "bg-sky-500/10 text-sky-700",
  },
  data: {
    label: "数据与知识",
    description: "连接数据库、搜索、分析与 ETL，比较能安全读取并使用企业数据的 AI Skills 与 MCP Servers。",
    intro: [
      "数据类工具的核心不是“能查到”，而是能否在正确权限和数据边界内稳定返回可验证结果。接入数据库、向量库、知识库或分析平台前，应区分只读查询、写入变更与管理操作，并检查工具是否限制 SQL、集合、字段、行数和外部网络目标。",
      "本站将公开文档、工具定义、静态风险和维护信号放在同一报告里，帮助你识别凭证回显、任意查询、提示注入和过度授权。评测不能替代真实数据环境的权限测试，但可以先淘汰缺少边界说明或证据不足的候选。",
    ],
    criteria: ["优先使用只读、最小范围和短期凭证", "验证输入过滤、结果脱敏、日志与审计策略", "确认限流、超时、分页和大结果集处理方式"],
    icon: Database,
    accent: "bg-violet-500/10 text-violet-700",
  },
  design: {
    label: "设计与创意",
    description: "覆盖 UI/UX、图像与内容生产，用可复核证据比较创意质量、工作流适配和使用边界。",
    intro: [
      "创意类 AI 能力常以漂亮样例吸引用户，但选型还要看输入规范、输出格式、迭代控制和资产归属。用于设计系统、品牌素材或批量内容时，应确认它能否保持风格一致、复用上下文，并明确处理参考图、字体、版权素材和用户数据的方式。",
      "本分类关注的不只是生成结果，还包括安装与配置是否清晰、失败后能否继续编辑、是否暴露不必要的文件或网络权限，以及项目是否持续维护。建议先用非敏感素材完成小规模验证，再把通过检查的能力接入正式创作链路。",
    ],
    criteria: ["比较可控性、格式兼容与多轮迭代能力", "核对素材来源、许可证和隐私处理说明", "验证输出能否进入现有设计与发布工具链"],
    icon: Palette,
    accent: "bg-pink-500/10 text-pink-700",
  },
  productivity: {
    label: "效率与办公",
    description: "串联文档、邮件、笔记与协作工具，筛选权限清晰、可确认且能稳定复用的 AI 工作流能力。",
    intro: [
      "效率工具往往能访问邮件、日历、文档和团队空间，因此“节省几步操作”不能抵消错误发送、越权读取或静默修改的风险。选择时要逐项确认读取、创建、更新、删除和对外发送的边界，高影响动作应展示真实参数并在执行前获得确认。",
      "本站通过公开证据检查安装说明、权限设计、安全模式、工程质量与维护状态。对于会写入第三方系统的能力，建议先连接测试账号和最小数据集，验证重试、幂等、错误恢复和审计记录，再逐步扩大使用范围。",
    ],
    criteria: ["列出每个连接器实际读取和写入的对象", "要求发送、删除、支付与权限变更前确认", "检查重试是否会造成重复任务或重复消息"],
    icon: Zap,
    accent: "bg-amber-500/10 text-amber-700",
  },
  other: {
    label: "更多能力",
    description: "探索跨场景与新型 AI 能力，先确认交付物类型、公开证据和权限边界，再决定是否采用。",
    intro: [
      "尚未归入常用分类的项目，可能是新协议实现、复合 Agent Pack、垂直行业工具或仍在快速变化的实验能力。名称和宣传文案很难说明它实际交付的是 Skill、MCP Server 还是完整工作流，因此第一步应查看仓库结构、安装入口和真实运行方式。",
      "本分类保留这些项目的公开评测与证据，同时避免因为新颖度而降低安全和工程标准。若报告缺少运行时验证、许可证或维护信号，应把它视为待补证据，而不是默认通过；生产接入前仍需在隔离环境完成最小权限测试。",
    ],
    criteria: ["先确认项目类型、安装入口与预期输出", "对实验性依赖和高权限动作设置隔离边界", "记录版本、复测日期和停止使用条件"],
    icon: Sparkles,
    accent: "bg-primary/10 text-primary",
  },
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

      <section className="grid gap-6 rounded-[2rem] border bg-card p-6 sm:p-8 lg:grid-cols-[1.6fr_1fr]" aria-labelledby="category-selection-guide">
        <div>
          <div className="section-eyebrow">Selection guide</div>
          <h2 id="category-selection-guide" className="mt-2 text-2xl font-extrabold tracking-[-0.035em]">这类能力应该怎么选</h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-foreground/80 sm:text-[15px]">
            {cat.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </div>
        <div className="rounded-2xl bg-muted/50 p-5">
          <h3 className="font-bold">先核对这三项</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            {cat.criteria.map((item, index) => (
              <li key={item} className="flex gap-3"><span className="font-mono text-xs font-bold text-primary">0{index + 1}</span><span>{item}</span></li>
            ))}
          </ul>
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
