"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, RefreshCw, Trophy } from "lucide-react";
import { SkillCard } from "./SkillCard";
import type { RankingPeriod } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface RankingItem {
  rank: number;
  score: string;
  skillId: string;
  slug: string;
  name: string;
  description: string | null;
  type: "claude-skill" | "mcp-server" | "agent-pack";
  category: string | null;
  tags: string[] | null;
  authorName: string | null;
  authorAvatar: string | null;
  githubStars: number | null;
  license: string | null;
}

const PERIODS: { value: RankingPeriod; label: string; detail: string }[] = [
  { value: "daily", label: "今日", detail: "24 小时" },
  { value: "weekly", label: "本周", detail: "7 天" },
  { value: "monthly", label: "本月", detail: "30 天" },
];

interface RankingTabsProps {
  initialData?: RankingItem[];
  initialSnapshotDate?: string | null;
  initialIsStale?: boolean;
}

export function RankingTabs({
  initialData = [],
  initialSnapshotDate = null,
  initialIsStale = false,
}: RankingTabsProps) {
  const [period, setPeriod] = useState<RankingPeriod>("daily");
  const [data, setData] = useState<RankingItem[]>(initialData);
  const [loading, setLoading] = useState(initialData.length === 0);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [snapshotDate, setSnapshotDate] = useState<string | null>(initialSnapshotDate);
  const [isStale, setIsStale] = useState(initialIsStale);
  const skippedInitialFetch = useRef(false);

  useEffect(() => {
    if (!skippedInitialFetch.current && period === "daily" && retry === 0 && initialData.length > 0) {
      skippedInitialFetch.current = true;
      return;
    }
    skippedInitialFetch.current = true;
    const controller = new AbortController();

    fetch(`/api/rankings?period=${period}&limit=6`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("榜单加载失败");
        return response.json();
      })
      .then((result) => {
        setData(result.items ?? []);
        setSnapshotDate(result.snapshotDate ?? null);
        setIsStale(Boolean(result.isStale));
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [initialData.length, period, retry]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border bg-card p-1" role="tablist" aria-label="榜单时间范围">
          {PERIODS.map(({ value, label, detail }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={period === value}
              aria-controls="ranking-panel"
              onClick={() => {
                if (value === period) return;
                setLoading(true);
                setError(false);
                setPeriod(value);
              }}
              className={cn(
                "flex min-h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors sm:px-4",
                period === value ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              <span className={cn("hidden text-[10px] sm:inline", period === value ? "text-background/55" : "text-muted-foreground/65")}>{detail}</span>
            </button>
          ))}
        </div>
        {!loading && snapshotDate && (
          <div className={cn("text-xs", isStale ? "font-semibold text-amber-700" : "text-muted-foreground")}>
            {isStale ? "数据更新延迟 · " : "数据截至 "}{snapshotDate.replace(/-/g, ".")}
          </div>
        )}
      </div>

      <div id="ranking-panel" role="tabpanel" aria-live="polite">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="surface-card min-h-[230px] animate-pulse p-5">
                <div className="h-6 w-20 rounded-full bg-muted" />
                <div className="mt-5 h-5 w-3/4 rounded bg-muted" />
                <div className="mt-3 h-4 w-full rounded bg-muted" />
                <div className="mt-2 h-4 w-4/5 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="surface-card flex flex-col items-center px-6 py-12 text-center">
            <AlertCircle className="h-7 w-7 text-primary" />
            <div className="mt-3 font-bold">榜单暂时没有加载成功</div>
            <p className="mt-1 text-sm text-muted-foreground">其他内容仍可正常浏览，请稍后再试。</p>
            <button type="button" onClick={() => setRetry((value) => value + 1)} className="filter-pill mt-5">
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> 重新加载
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className="surface-card flex flex-col items-center px-6 py-12 text-center">
            <Trophy className="h-8 w-8 text-primary" />
            <div className="mt-3 font-bold">本期榜单正在生成</div>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">我们正在汇总增长、下载与活跃度数据，榜单生成后会在这里展示。</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                  tags: item.tags ?? [],
                  authorName: item.authorName,
                  authorAvatar: item.authorAvatar,
                  githubStars: item.githubStars ?? 0,
                  license: item.license,
                  firstSeenAt: new Date(),
                }}
                rank={item.rank}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
