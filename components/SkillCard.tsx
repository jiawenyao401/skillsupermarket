import Link from "next/link";
import { ArrowUpRight, Bot, Braces, ShieldCheck, Sparkles, Star, User } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface SkillCardProps {
  skill: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    type: "claude-skill" | "mcp-server" | "agent-pack";
    category: string | null;
    tags: string[];
    authorName: string | null;
    authorAvatar: string | null;
    githubStars: number;
    license: string | null;
    firstSeenAt: Date;
  };
  score?: number;
  rank?: number;
  showScore?: boolean;
  tone?: "light" | "dark";
}

const TYPE_META = {
  "claude-skill": {
    label: "Skill",
    icon: Sparkles,
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  "mcp-server": {
    label: "MCP",
    icon: Braces,
    className: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  "agent-pack": {
    label: "Agent",
    icon: Bot,
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
} as const;

const CATEGORY_LABELS: Record<string, string> = {
  programming: "编程",
  data: "数据",
  design: "设计",
  productivity: "效率",
  other: "其他",
};

export function SkillCard({ skill, score, rank, showScore, tone = "light" }: SkillCardProps) {
  const typeMeta = TYPE_META[skill.type];
  const TypeIcon = typeMeta.icon;
  const isDark = tone === "dark";

  return (
    <Link
      href={`/skill/${skill.slug}`}
      className={cn(
        "group relative flex min-h-[230px] flex-col overflow-hidden rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl",
        isDark
          ? "border-white/10 bg-white/[0.06] text-background hover:border-primary/40 hover:bg-white/[0.09] hover:shadow-black/20"
          : "bg-card hover:border-primary/30 hover:shadow-black/[0.06]"
      )}
    >
      {rank && (
        <span className={cn(
          "absolute right-4 top-4 font-mono text-xl font-black tracking-tighter",
          rank <= 3 ? "text-primary" : isDark ? "text-background/25" : "text-foreground/15"
        )}>
          {String(rank).padStart(2, "0")}
        </span>
      )}

      <div className="flex min-h-7 items-center gap-2 pr-10">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold", typeMeta.className)}>
          <TypeIcon className="h-3 w-3" /> {typeMeta.label}
        </span>
        {skill.category && (
          <span className={cn("text-[11px] font-medium", isDark ? "text-background/50" : "text-muted-foreground")}>
            {CATEGORY_LABELS[skill.category] ?? skill.category}
          </span>
        )}
        {score !== undefined && showScore !== false && (
          <span className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold",
            isDark ? "bg-primary/20 text-orange-200" : "bg-primary/10 text-primary"
          )}>
            <ShieldCheck className="h-3 w-3" /> {score}
          </span>
        )}
      </div>

      <h3 className="mt-4 line-clamp-2 pr-3 text-[17px] font-extrabold leading-snug tracking-[-0.02em]">
        {skill.name}
      </h3>
      <p className={cn("mt-2 line-clamp-3 text-sm leading-6", isDark ? "text-background/60" : "text-muted-foreground")}>
        {skill.description || "社区收录的 AI 能力，打开查看完整信息、评分与使用说明。"}
      </p>

      <div className="mt-auto pt-5">
        {skill.tags.length > 0 && (
          <div className="mb-4 flex min-h-6 flex-wrap gap-1.5">
            {skill.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className={cn(
                  "max-w-[9rem] truncate rounded-md px-2 py-1 text-[10px] font-medium",
                  isDark ? "bg-white/[0.07] text-background/55" : "bg-muted text-muted-foreground"
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className={cn("flex items-center gap-3 border-t pt-3 text-xs", isDark ? "border-white/10 text-background/50" : "text-muted-foreground")}>
          {skill.githubStars > 0 && (
            <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" /> {formatNumber(skill.githubStars)}</span>
          )}
          {skill.authorName && (
            <span className="flex min-w-0 items-center gap-1 truncate"><User className="h-3.5 w-3.5 shrink-0" /> {skill.authorName}</span>
          )}
          <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
