import Link from "next/link";
import { Badge } from "./ui/Badge";
import { Star, GitFork, Download, Calendar, User } from "lucide-react";
import { formatNumber, relativeTime } from "@/lib/utils";

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
}

const TYPE_LABELS = {
  "claude-skill": "Skill",
  "mcp-server": "MCP",
  "agent-pack": "Agent",
} as const;

const TYPE_COLORS = {
  "claude-skill": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "mcp-server": "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  "agent-pack": "bg-green-500/10 text-green-700 dark:text-green-300",
} as const;

export function SkillCard({ skill, score, rank, showScore }: SkillCardProps) {
  return (
    <Link
      href={`/skill/${skill.slug}`}
      className="block rounded-lg border p-4 hover:border-primary/50 hover:shadow-md transition-all bg-card"
    >
      <div className="flex items-start gap-2 mb-2">
        {rank && rank <= 3 && (
          <span
            className={`text-lg font-bold ${
              rank === 1
                ? "text-yellow-500"
                : rank === 2
                ? "text-gray-400"
                : "text-orange-700"
            }`}
          >
            {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
          </span>
        )}
        {rank && rank > 3 && (
          <span className="text-sm font-mono text-muted-foreground w-6 text-center">
            {rank}
          </span>
        )}
        <Badge className={TYPE_COLORS[skill.type]}>{TYPE_LABELS[skill.type]}</Badge>
        {skill.category && <Badge variant="outline">{skill.category}</Badge>}
        {score !== undefined && showScore !== false && (
          <Badge variant="secondary" className="ml-auto">
            ⭐ {score}
          </Badge>
        )}
      </div>

      <h3 className="font-semibold text-base leading-tight mb-1 line-clamp-1">
        {skill.name}
      </h3>

      {skill.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {skill.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {skill.githubStars > 0 && (
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3" /> {formatNumber(skill.githubStars)}
          </span>
        )}
        {skill.authorName && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" /> {skill.authorName}
          </span>
        )}
        {skill.license && <span>📄 {skill.license}</span>}
      </div>

      {skill.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {skill.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
