import {
  AlertTriangle,
  BadgeCheck,
  Check,
  CircleAlert,
  FileCheck2,
  Gauge,
  Info,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Wrench,
  X,
} from "lucide-react";
import type { EvaluationReport as EvaluationReportType, RiskLevel, SecurityFinding } from "@/lib/types";
import { buildLegacySummary } from "@/lib/evaluation-scoring";
import { cn } from "@/lib/utils";
import { EvaluationRadar } from "./EvaluationRadar";

interface EvaluationRecord {
  overallScore: number;
  documentationScore: number;
  securityScore: number;
  popularityScore: number;
  activityScore: number;
  qualityScore: number;
  evaluatedAt: Date | null;
}

interface EvaluationReportProps {
  evaluation: EvaluationRecord;
  report: EvaluationReportType;
}

const RISK_LABELS = { low: "低风险", medium: "中风险", high: "高风险", critical: "关键风险" } as const;
const RISK_STYLES = {
  low: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  high: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
} as const;
const CONFIDENCE_STATUS_STYLES = {
  strong: "bg-emerald-500/10 text-emerald-700",
  partial: "bg-amber-500/10 text-amber-700",
  missing: "bg-muted text-muted-foreground",
} as const;

function legacySummary(evaluation: EvaluationRecord, report: EvaluationReportType) {
  const risk: RiskLevel = report.security.findings.some((finding) => finding.level === "danger") ? "high" : report.security.findings.length ? "medium" : "low";
  return buildLegacySummary(evaluation.overallScore, risk);
}

function FindingIcon({ finding }: { finding: SecurityFinding }) {
  if (finding.level === "danger") return <ShieldAlert className="h-5 w-5 text-destructive" />;
  if (finding.level === "warning") return <AlertTriangle className="h-5 w-5 text-amber-600" />;
  return <Info className="h-5 w-5 text-sky-600" />;
}

export function EvaluationReport({ evaluation, report }: EvaluationReportProps) {
  const summary = report.summary ?? legacySummary(evaluation, report);
  const riskLevel = summary.riskLevel;
  const recommendation = report.recommendation;
  const checks = report.documentation.checks ?? [];
  const findings = report.security.findings ?? [];
  const confidenceFactors = report.methodology?.confidenceFactors ?? [];
  const scoreDimensions = [
    ["文档", evaluation.documentationScore, "22%"],
    ["安全", evaluation.securityScore, "25%"],
    ["质量", evaluation.qualityScore, "30%"],
    ["活跃", evaluation.activityScore, "13%"],
    ["采用", evaluation.popularityScore, "10%"],
  ] as const;

  return (
    <section className="space-y-6" aria-labelledby="evaluation-report-title">
      <div className="overflow-hidden rounded-[2rem] border bg-card">
        <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
          <div className="relative flex min-h-72 flex-col justify-between overflow-hidden bg-foreground p-6 text-background sm:p-8">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Evaluation report</div>
              <h2 id="evaluation-report-title" className="mt-3 text-xl font-extrabold">综合采用结论</h2>
            </div>
            <div className="relative mt-8 flex items-end gap-5">
              <div className="text-7xl font-black tracking-[-0.08em]">{evaluation.overallScore}</div>
              <div className="pb-2">
                <div className="text-3xl font-black text-primary">{summary.grade}</div>
                <div className="mt-1 text-xs text-background/45">满分 100</div>
              </div>
            </div>
            <div className="relative mt-8 flex flex-wrap gap-2">
              <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white">{summary.verdictLabel}</span>
              <span className={cn("rounded-full border px-3 py-1.5 text-xs font-bold", RISK_STYLES[riskLevel])}>{RISK_LABELS[riskLevel]}</span>
            </div>
          </div>
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold"><BadgeCheck className="h-4 w-4 text-primary" /> 决策摘要</div>
                <p className="mt-3 max-w-2xl text-xl font-extrabold leading-snug tracking-[-0.025em]">{summary.headline}</p>
              </div>
              <div className="shrink-0 rounded-xl bg-muted px-3 py-2 text-center">
                <div className="text-lg font-black tabular-nums">{summary.confidence}%</div>
                <div className="text-[10px] text-muted-foreground">{summary.confidenceLabel}置信度</div>
              </div>
            </div>
            <div className="mt-7 grid grid-cols-5 gap-2">
              {scoreDimensions.map(([label, score, weight]) => (
                <div key={label} className="rounded-xl border bg-background p-2.5 text-center sm:p-3">
                  <div className="text-lg font-black tabular-nums sm:text-xl">{score}</div>
                  <div className="mt-0.5 text-[10px] font-semibold sm:text-xs">{label}</div>
                  <div className="mt-1 hidden text-[9px] text-muted-foreground sm:block">权重 {weight}</div>
                </div>
              ))}
            </div>
            <div className="mt-7 h-2 overflow-hidden rounded-full bg-muted" aria-label={`评测置信度 ${summary.confidence}%`}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${summary.confidence}%` }} />
            </div>
            {confidenceFactors.length > 0 ? (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="置信度构成">
                {confidenceFactors.map((factor) => (
                  <li key={factor.id} className="flex items-start gap-2 rounded-xl border bg-background p-3">
                    <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", CONFIDENCE_STATUS_STYLES[factor.status])}>
                      {factor.status === "strong" ? <Check className="h-3 w-3" /> : factor.status === "partial" ? <CircleAlert className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 text-xs font-bold"><span>{factor.label}</span><span className="font-mono text-[10px] text-muted-foreground">+{factor.contribution}/{factor.maxContribution}</span></span>
                      <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{factor.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">历史报告未保存置信度明细；重新评测后可查看各项证据贡献。</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="surface-card p-5 sm:p-6">
          <div className="flex items-center gap-2 font-bold"><Gauge className="h-5 w-5 text-primary" /> 五维表现</div>
          <div className="mt-4"><EvaluationRadar evaluation={evaluation} /></div>
          <div className="mt-3 rounded-xl bg-muted p-3 text-xs leading-5 text-muted-foreground">{report.quality.llmComment || report.quality.details}</div>
          {report.quality.evidence?.length ? (
            <div className="mt-4 border-t pt-4">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">AI 复核证据</div>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                {report.quality.evidence.map((item) => (
                  <li key={item} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span>{item}</span></li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="surface-card p-5 sm:p-6">
          <div className="flex items-center gap-2 font-bold"><Target className="h-5 w-5 text-primary" /> 采用建议</div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">优势</div>
              <ul className="mt-3 space-y-2 text-sm">
                {(recommendation?.strengths?.length ? recommendation.strengths : report.documentation.strengths ?? []).slice(0, 5).map((item) => (
                  <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{item}</span></li>
                ))}
                {!(recommendation?.strengths?.length || report.documentation.strengths?.length) && <li className="text-muted-foreground">证据不足，暂未确认明确优势</li>}
              </ul>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-amber-700">关注点</div>
              <ul className="mt-3 space-y-2 text-sm">
                {(recommendation?.concerns ?? report.documentation.improvements ?? []).slice(0, 5).map((item) => (
                  <li key={item} className="flex gap-2"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span>{item}</span></li>
                ))}
                {!(recommendation?.concerns?.length || report.documentation.improvements?.length) && <li className="text-muted-foreground">当前证据未显示明显关注点</li>}
              </ul>
            </div>
          </div>
          {recommendation && (recommendation.bestFor.length > 0 || recommendation.avoidFor.length > 0) && (
            <div className="mt-6 grid gap-3 border-t pt-5 sm:grid-cols-2">
              <div className="rounded-xl bg-emerald-500/[0.07] p-4"><div className="text-xs font-bold text-emerald-700">适合</div><p className="mt-2 text-sm leading-6">{recommendation.bestFor.join("、") || "受控试用与进一步验证"}</p></div>
              <div className="rounded-xl bg-destructive/[0.05] p-4"><div className="text-xs font-bold text-destructive">不建议直接用于</div><p className="mt-2 text-sm leading-6">{recommendation.avoidFor.join("、") || "涉及敏感数据的高风险场景"}</p></div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-bold"><FileCheck2 className="h-5 w-5 text-primary" /> 文档证据</div>
            <span className="text-xs font-bold text-muted-foreground">{report.documentation.score}/100</span>
          </div>
          {checks.length > 0 ? (
            <div className="mt-4 divide-y">
              {checks.map((check) => (
                <div key={check.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full", check.passed ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground")}>
                    {check.passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </span>
                  <span className={cn("flex-1", !check.passed && "text-muted-foreground")}>{check.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{check.weight} 分</span>
                </div>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-muted-foreground">{report.documentation.details}</p>}
        </div>

        <div className="surface-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-bold">{riskLevel === "low" ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 text-destructive" />} 安全证据</div>
            <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold", RISK_STYLES[riskLevel])}>{RISK_LABELS[riskLevel]}</span>
          </div>
          {findings.length === 0 ? (
            <div className="mt-5 rounded-xl bg-emerald-500/[0.07] p-5 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-emerald-600" /><div className="mt-3 font-bold">未发现已知高风险模式</div><p className="mt-1 text-xs text-muted-foreground">静态扫描不是安全保证，生产接入前仍应人工复核权限和数据边界。</p></div>
          ) : (
            <div className="mt-4 space-y-3">
              {findings.slice(0, 8).map((finding, index) => (
                <div key={`${finding.location}-${finding.type}-${index}`} className="rounded-xl border bg-background p-4">
                  <div className="flex items-start gap-3"><FindingIcon finding={finding} /><div className="min-w-0"><div className="text-sm font-bold">{finding.message}</div><div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground"><code>{finding.type}</code>{finding.location && <span>{finding.location}</span>}{finding.confidence && <span>{finding.confidence} confidence</span>}</div></div></div>
                  {finding.evidence && <code className="mt-3 block overflow-hidden rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">{finding.evidence}</code>}
                  {finding.remediation && <p className="mt-3 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">修复：</strong>{finding.remediation}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {recommendation?.nextActions?.length ? (
        <div className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2 font-bold"><Wrench className="h-5 w-5 text-primary" /> 优先改进清单</div>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendation.nextActions.map((action, index) => <li key={action} className="flex gap-3 rounded-xl bg-muted/70 p-4 text-sm leading-6"><span className="font-mono text-xs font-bold text-primary">{String(index + 1).padStart(2, "0")}</span><span>{action}</span></li>)}
          </ol>
        </div>
      ) : null}

      <details className="surface-card group p-5 sm:p-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> 方法、证据与局限</span><span className="text-sm text-muted-foreground group-open:hidden">展开</span><span className="hidden text-sm text-muted-foreground group-open:inline">收起</span>
        </summary>
        <div className="mt-5 grid gap-5 border-t pt-5 text-sm sm:grid-cols-2">
          <div><div className="font-semibold">数据来源</div><p className="mt-2 leading-6 text-muted-foreground">{report.methodology?.sources.join("、") || "项目元数据与 README"}</p></div>
          <div><div className="font-semibold">扫描范围</div><p className="mt-2 leading-6 text-muted-foreground">{report.methodology ? `${report.methodology.scannedFiles.length} 个文件 · ${report.methodology.scannedCharacters.toLocaleString()} 字符` : "历史评测未记录扫描范围"}</p></div>
          <div><div className="font-semibold">评测引擎</div><p className="mt-2 leading-6 text-muted-foreground">v{report.methodology?.evaluatorVersion ?? report.version ?? "1.x"} · AI 复核{report.methodology?.aiJudgeUsed ? `已启用${report.methodology.aiJudgeModel ? `（${report.methodology.aiJudgeModel}）` : ""}` : "未启用"}</p></div>
          <div><div className="font-semibold">局限</div><ul className="mt-2 list-disc space-y-1 pl-5 leading-6 text-muted-foreground">{(report.methodology?.limitations ?? ["静态评测不能替代人工安全审计"]).map((item) => <li key={item}>{item}</li>)}</ul></div>
        </div>
      </details>
    </section>
  );
}
