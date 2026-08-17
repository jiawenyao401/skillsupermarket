"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  FileCheck2,
  FileSearch,
  Gauge,
  Github,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { QuotaSnapshot } from "@/lib/quota-policy";

type EvaluationStatus = "pending" | "running" | "done" | "failed";
interface EvaluationResult {
  slug?: string;
  jobId?: string;
  status?: EvaluationStatus;
  stage?: string;
  progress?: number;
  cached?: boolean;
  duplicate?: boolean;
  message?: string;
  overallScore?: number | null;
  quota?: QuotaSnapshot;
}

const STAGE_LABELS: Record<string, string> = {
  queued: "等待执行", metadata: "验证项目与元数据", evidence: "采集 README 与高信号文件",
  security: "扫描安全风险", quality: "执行质量复核", report: "生成证据化报告",
  retrying: "自动重试中", recovered: "任务已恢复", done: "评测完成", failed: "评测失败",
};

const STEPS = [
  { icon: FileSearch, title: "证据采集", description: "读取元数据、README、SKILL.md 与关键清单文件" },
  { icon: ShieldCheck, title: "安全静态扫描", description: "识别提示注入、泄露凭证、命令执行与供应链风险" },
  { icon: Gauge, title: "双轨质量评分", description: "确定性检查为主，AI 仅做保守的结构化复核" },
  { icon: PackageCheck, title: "可解释报告", description: "输出结论、置信度、风险证据与可执行改进项" },
] as const;

const DIMENSIONS = [
  ["文档完整度", "22%", "安装、示例、参数、限制与错误处理"],
  ["安全性", "25%", "风险模式、凭证、权限与供应链"],
  ["工程质量", "30%", "实用、清晰、复用、设计与文档"],
  ["活跃度", "13%", "维护新鲜度与问题积压信号"],
  ["采用度", "10%", "Stars、下载、Fork 与近期增长"],
] as const;

export function EvaluationWorkbench({
  userName,
  initialQuota,
  initialSource = null,
  initialSkillName = null,
}: {
  userName: string;
  initialQuota: QuotaSnapshot;
  initialSource?: string | null;
  initialSkillName?: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialSource ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState(initialQuota);
  const isActive = Boolean(result?.jobId && (result.status === "pending" || result.status === "running"));
  const isSelectedSkill = Boolean(initialSource && initialSkillName && url.trim() === initialSource);

  useEffect(() => {
    const jobId = result?.jobId;
    if (!isActive || !jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const response = await fetch(`/api/evaluate/${jobId}`, { cache: "no-store" });
        if (response.status === 401) { router.replace("/login?returnTo=%2Fevaluate"); return; }
        if (!response.ok) throw new Error("进度查询失败");
        const data = await response.json();
        if (cancelled) return;
        setResult((current) => ({ ...current, ...data }));
        if (data.status === "pending" || data.status === "running") timer = setTimeout(poll, 1800);
      } catch { if (!cancelled) timer = setTimeout(poll, 3500); }
    }
    timer = setTimeout(poll, 900);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [isActive, result?.jobId, router]);

  const progress = Math.max(0, Math.min(100, result?.progress ?? 0));
  const statusTitle = useMemo(() => {
    if (result?.status === "done") return result.cached ? "已找到最新评测" : "评测完成";
    if (result?.status === "failed") return "评测暂时失败";
    if (result?.duplicate) return "已接入正在执行的任务";
    return "评测正在进行";
  }, [result]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true); setError(null); setResult(null);
    try {
      const response = await fetch("/api/evaluate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }),
      });
      if (response.status === 401) { router.replace("/login?returnTo=%2Fevaluate"); return; }
      const data = await response.json();
      if (data.quota) setQuota(data.quota);
      if (!response.ok) throw new Error(data.error ?? "提交失败，请稍后重试");
      setResult(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "提交失败，请稍后重试");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <section className="relative overflow-hidden rounded-[2rem] border bg-card px-6 py-12 text-center sm:px-10 sm:py-16">
        <div className="hero-grid" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-6 w-6" /></span>
          <div className="section-eyebrow mt-6">Evaluation Engine 3.0 · 已登录</div>
          <h1 className="mt-3 text-balance text-3xl font-black tracking-[-0.045em] sm:text-5xl">{userName}，开始一份可以复核的采用决策</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">基于真实证据评估文档、安全、工程质量、活跃度与采用度。每个结论都给出依据、置信度和下一步建议。</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="surface-card p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-2 font-bold"><Github className="h-5 w-5" /> {isSelectedSkill ? `评测 ${initialSkillName}` : "提交公开项目"}</div><Link href="/account" className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary"><WalletCards className="h-3.5 w-3.5" /> 本周剩余 {quota.remaining}/{quota.limit}</Link></div>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="evaluation-url" className="text-sm font-semibold">GitHub、npm 或 PyPI 项目</label>
              <div className="relative mt-2">
                <input id="evaluation-url" type="text" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://github.com/owner/project 或 @scope/package" className="h-12 w-full rounded-xl border bg-background px-4 pr-32 text-sm shadow-inner outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10" aria-describedby="evaluation-help" aria-invalid={Boolean(error)} disabled={submitting || isActive} maxLength={500} required />
                <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 text-[10px] text-muted-foreground sm:block">公开项目 · 最多 500 字符</span>
              </div>
              <p id="evaluation-help" className="mt-2 text-xs leading-5 text-muted-foreground">PyPI 包名请使用 <code className="rounded bg-muted px-1.5 py-0.5">pypi:包名</code>，避免与 npm 同名包歧义。</p>
            </div>
            <Button type="submit" disabled={submitting || isActive || !url.trim()} className="h-12 w-full rounded-xl text-sm">
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在验证来源…</> : isActive ? <><CircleDashed className="mr-2 h-4 w-4 animate-spin" /> 评测进行中</> : quota.remaining <= 0 ? <>查找免费缓存报告 <ArrowRight className="ml-2 h-4 w-4" /></> : isSelectedSkill ? <>开始评测 {initialSkillName} <ArrowRight className="ml-2 h-4 w-4" /></> : <>开始深度评测 <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </form>
          {error && <div role="alert" className="mt-4 flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          {result && (
            <div role="status" aria-live="polite" className={`mt-5 rounded-2xl border p-5 ${result.status === "failed" ? "border-destructive/30 bg-destructive/5" : "border-emerald-500/20 bg-emerald-500/[0.06]"}`}>
              <div className="flex items-start gap-3">
                {result.status === "done" ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : result.status === "failed" ? <TriangleAlert className="mt-0.5 h-5 w-5 text-destructive" /> : <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-primary" />}
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-bold">{statusTitle}</div>{result.status !== "failed" && <span className="text-xs font-bold tabular-nums text-muted-foreground">{progress}%</span>}</div>
                  {result.status !== "done" && result.status !== "failed" && <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.max(progress, 4)}%` }} /></div>}
                  <p className="mt-2 text-sm text-muted-foreground">{result.status === "failed" ? "系统已完成自动重试，请稍后重新提交。" : result.status === "done" ? result.message ?? "报告已生成，可以查看完整证据与建议。" : STAGE_LABELS[result.stage ?? "queued"] ?? "正在处理"}</p>
                  <div className="mt-4 flex flex-wrap gap-2">{result.slug && result.status === "done" && <Link href={`/skill/${result.slug}`} className="button-primary h-9 px-4 text-sm">查看完整报告 <ArrowRight className="ml-1.5 h-4 w-4" /></Link>}{result.status === "failed" && <button type="button" onClick={() => { setResult(null); setError(null); }} className="filter-pill"><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> 重新提交</button>}</div>
                </div>
              </div>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t pt-5 text-xs text-muted-foreground">{["不克隆执行代码", "敏感证据自动脱敏", "任务归属当前账号", "失败任务自动恢复"].map((item) => <span key={item} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> {item}</span>)}</div>
        </section>

        <aside className="surface-card p-5 sm:p-7"><div className="flex items-center gap-2 font-bold"><FileCheck2 className="h-5 w-5 text-primary" /> 一次评测包含</div><ol className="mt-6 space-y-5">{STEPS.map(({ icon: Icon, title, description }, index) => <li key={title} className="flex gap-3"><span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground"><Icon className="h-4 w-4" /><span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[9px] font-bold text-background">{index + 1}</span></span><div><div className="text-sm font-bold">{title}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></li>)}</ol></aside>
      </div>

      <section className="rounded-[2rem] bg-foreground px-6 py-9 text-background sm:px-8"><div className="max-w-2xl"><div className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Transparent methodology</div><h2 className="mt-2 text-2xl font-extrabold tracking-tight">权重公开，安全风险有硬上限</h2><p className="mt-2 text-sm leading-6 text-background/55">安全高风险会限制总分，避免项目仅凭流行度或营销文档掩盖关键问题。</p></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{DIMENSIONS.map(([dimension, weight, detail], index) => <div key={dimension} className="rounded-xl border border-white/10 bg-white/[0.06] p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-primary">0{index + 1}</span><span className="font-mono text-xs text-background/45">{weight}</span></div><div className="mt-3 text-sm font-semibold">{dimension}</div><div className="mt-1.5 text-xs leading-5 text-background/45">{detail}</div></div>)}</div></section>
    </div>
  );
}
