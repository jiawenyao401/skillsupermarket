"use client";

import { useEffect, useState } from "react";
import { SkillCard } from "./SkillCard";
import type { RankingPeriod } from "@/lib/types";
import { Loader2 } from "lucide-react";

interface RankingItem {
  rank: number;
  score: string;
  skillId: string;
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
}

export function RankingTabs() {
  const [period, setPeriod] = useState<RankingPeriod>("daily");
  const [data, setData] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/rankings?period=${period}&limit=10`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.items ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["daily", "weekly", "monthly"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              period === p
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/70"
            }`}
          >
            {p === "daily" ? "今日" : p === "weekly" ? "本周" : "本月"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中...
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          暂无榜单数据。运行 <code className="bg-muted px-1.5 py-0.5 rounded">npm run rank</code> 生成。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.map((item) => (
            <SkillCard
              key={item.skillId}
              skill={{
                id: item.skillId,
                slug: item.slug,
                name: item.name,
                description: item.description,
                type: item.type,
                category: item.category,
                tags: item.tags,
                authorName: item.authorName,
                authorAvatar: item.authorAvatar,
                githubStars: item.githubStars,
                license: item.license,
                firstSeenAt: new Date(),
              }}
              rank={item.rank}
            />
          ))}
        </div>
      )}
    </div>
  );
}
