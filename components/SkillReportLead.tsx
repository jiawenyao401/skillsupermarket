import Link from "next/link";
import { ArrowDownRight } from "lucide-react";
import type { EvaluationReport } from "@/lib/types";

interface SkillReportLeadProps {
  score: number;
  report: EvaluationReport | undefined;
}

export function SkillReportLead({ score, report }: SkillReportLeadProps) {
  const headline = typeof report?.summary?.headline === "string" && report.summary.headline.trim()
    ? report.summary.headline
    : "查看公开评测证据与采用建议";

  return (
    <div className="mt-6 max-w-2xl rounded-2xl border border-primary/20 bg-primary/[0.045] p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="shrink-0" aria-label={`综合评分 ${score} 分，满分 100 分`}>
          <span className="text-4xl font-black tabular-nums tracking-[-0.06em] text-primary">{score}</span>
          <span className="ml-1 text-xs font-semibold text-muted-foreground">/ 100</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wide text-primary">公开评测 · 综合采用结论</p>
          <p className="mt-1 text-sm font-semibold leading-6 [overflow-wrap:anywhere]">{headline}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href="#evaluation-report-title"
          data-traffic-event="report_open_click"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          查看评测依据 <ArrowDownRight aria-hidden="true" className="h-4 w-4" />
        </Link>
        <Link
          href="/evaluate"
          prefetch={false}
          className="inline-flex min-h-11 items-center rounded-xl px-1 text-sm font-semibold text-foreground underline decoration-primary/50 underline-offset-4 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          评测我的项目
        </Link>
        <span className="text-xs leading-5 text-muted-foreground">基于公开项目证据，非安全认证或安装推荐</span>
      </div>
    </div>
  );
}
