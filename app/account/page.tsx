import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarClock, CheckCircle2, CircleDashed, Clock3, Crown, History, Mail, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { evaluationJobs, skills, user } from "@/lib/schema";
import { getQuotaSnapshot } from "@/lib/quota";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "个人中心",
  description: "管理评测额度、历史记录与账户信息。",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const resetFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const STATUS_COPY = {
  pending: [CircleDashed, "排队中", "text-amber-700 bg-amber-500/10"],
  running: [CircleDashed, "评测中", "text-sky-700 bg-sky-500/10"],
  done: [CheckCircle2, "已完成", "text-emerald-700 bg-emerald-500/10"],
  failed: [TriangleAlert, "未完成", "text-rose-700 bg-rose-500/10"],
} as const;

export default async function AccountPage() {
  const session = await requireUser("/account");
  const quota = await getQuotaSnapshot(session.user.id);
  const weekStart = new Date(`${quota.periodStart}T00:00:00+08:00`);
  const [profile] = await db.select({ createdAt: user.createdAt }).from(user).where(eq(user.id, session.user.id)).limit(1);
  const [statistics] = await db.select({
    total: sql<number>`count(*)::int`,
    completed: sql<number>`count(*) filter (where ${evaluationJobs.status} = 'done')::int`,
  }).from(evaluationJobs).where(eq(evaluationJobs.userId, session.user.id));
  const [weekStatistics] = await db.select({ thisWeek: sql<number>`count(*)::int` })
    .from(evaluationJobs).where(and(
      eq(evaluationJobs.userId, session.user.id),
      gte(evaluationJobs.createdAt, weekStart),
    ));
  const history = await db.select({
    id: evaluationJobs.id, status: evaluationJobs.status, createdAt: evaluationJobs.createdAt,
    quotaUnits: evaluationJobs.quotaUnits, slug: skills.slug, name: skills.name, type: skills.type,
  }).from(evaluationJobs).innerJoin(skills, eq(skills.id, evaluationJobs.skillId))
    .where(eq(evaluationJobs.userId, session.user.id)).orderBy(desc(evaluationJobs.createdAt)).limit(12);
  const percentage = quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;
  const completionRate = statistics.total > 0 ? Math.round((statistics.completed / statistics.total) * 100) : 0;

  return <div className="mx-auto max-w-6xl space-y-8">
    <section className="relative overflow-hidden rounded-[2rem] border bg-card px-6 py-9 sm:px-9"><div className="hero-grid" aria-hidden="true" /><div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end"><div><div className="section-eyebrow">Personal workspace</div><h1 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-5xl">{session.user.name} 的个人中心</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">在一个地方查看本周额度、评测进展、历史报告与账户安全状态。</p></div><Link href="/evaluate" className="button-primary h-11 px-5 text-sm">提交新评测 <ArrowRight className="ml-2 h-4 w-4" /></Link></div></section>
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="surface-card p-6 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-bold"><Sparkles className="h-4 w-4 text-primary" /> 本周评测额度</div><div className="mt-5 flex items-end gap-2"><span className="text-5xl font-black tracking-[-0.06em]">{quota.remaining}</span><span className="pb-1.5 text-sm text-muted-foreground">次可用 / 共 {quota.limit} 次</span></div></div><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${quota.plan === "pro" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{quota.plan === "pro" ? <Crown className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />}{quota.plan === "pro" ? "专业版" : "免费版"}</span></div><div className="mt-6 h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} /></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>本周已使用 {quota.used} 次</span><span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> {resetFormatter.format(new Date(quota.resetsAt))} 重置</span></div><div className="mt-6 rounded-2xl border bg-muted/35 p-4 text-sm leading-6"><strong>计费规则：</strong>只有真正启动的新评测才扣 1 次；24 小时内的缓存报告、查看历史和重复任务均不扣额度。</div></section>
      <section className="surface-card p-6 sm:p-7"><div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-primary" /> 账户与安全</div><dl className="mt-5 space-y-4 text-sm"><div className="flex items-start gap-3"><Mail className="mt-0.5 h-4 w-4 text-muted-foreground" /><div className="min-w-0"><dt className="text-xs text-muted-foreground">登录邮箱</dt><dd className="mt-1 truncate font-semibold">{session.user.email}</dd></div></div><div className="flex items-start gap-3"><Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">加入时间</dt><dd className="mt-1 font-semibold">{profile?.createdAt ? dateFormatter.format(profile.createdAt) : "—"}</dd></div></div><div className="flex items-start gap-3"><BadgeCheck className="mt-0.5 h-4 w-4 text-emerald-600" /><div><dt className="text-xs text-muted-foreground">账号状态</dt><dd className="mt-1 font-semibold text-emerald-700">会话与评测归属已保护</dd></div></div></dl></section>
    </div>
    <div className="grid gap-4 sm:grid-cols-3">{[["累计提交", statistics.total, "份评测任务"], ["本周任务", weekStatistics.thisWeek, "含缓存与重复任务"], ["完成率", `${completionRate}%`, "已完成 / 累计提交"]].map(([label, value, detail]) => <div key={String(label)} className="surface-card p-5"><div className="text-xs font-semibold text-muted-foreground">{label}</div><div className="mt-2 text-3xl font-black tracking-tight">{value}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div>)}</div>
    <section className="surface-card overflow-hidden"><div className="flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-7"><div className="flex items-center gap-2 font-bold"><History className="h-4 w-4 text-primary" /> 最近评测</div><Link href="/evaluate" className="text-xs font-bold text-primary hover:underline">继续评测</Link></div>{history.length === 0 ? <div className="px-6 py-14 text-center"><History className="mx-auto h-8 w-8 text-muted-foreground/40" /><div className="mt-3 font-bold">还没有评测记录</div><p className="mt-1 text-sm text-muted-foreground">提交第一个公开项目，报告会保存在这里。</p><Link href="/evaluate" className="button-primary mt-5 h-10 px-4 text-sm">开始第一次评测</Link></div> : <div className="divide-y">{history.map((item) => { const status = item.status ?? "pending"; const [StatusIcon, label, classes] = STATUS_COPY[status]; return <div key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><div className="min-w-0"><Link href={`/skill/${item.slug}`} className="font-bold hover:text-primary">{item.name}</Link><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{item.type}</span><span>·</span><span>{item.createdAt ? dateFormatter.format(item.createdAt) : "—"}</span>{item.quotaUnits > 0 && <><span>·</span><span>消耗 {item.quotaUnits} 次</span></>}</div></div><div className="flex items-center gap-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}><StatusIcon className={`h-3.5 w-3.5 ${status === "running" || status === "pending" ? "animate-spin" : ""}`} />{label}</span>{status === "done" && <Link href={`/skill/${item.slug}`} className="text-xs font-bold text-primary">查看报告 →</Link>}</div></div>; })}</div>}</section>
  </div>;
}
