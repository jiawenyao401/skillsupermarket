import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  BookOpenCheck,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Database,
  Gauge,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { sql } from "drizzle-orm";
import { AdminCollectionChart, type DailySkillCollectionPoint } from "@/components/AdminCollectionChart";
import { requireSuperAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "运营后台",
  description: "Skill Supermarket 私有运营与用户统计后台。",
  robots: { index: false, follow: false, nocache: true },
};

const PAGE_SIZE = 25;

interface SummaryRow extends Record<string, unknown> {
  today: string;
  total_users: number;
  new_users_1d: number;
  new_users_7d: number;
  new_users_30d: number;
  active_subscriptions: number;
  active_skills: number;
  claude_skills: number;
  mcp_servers: number;
  agent_packs: number;
  new_skills_today: number;
  collected_skills_today: number;
  evaluated_skills: number;
  total_evaluations: number;
  jobs_1d: number;
  jobs_7d: number;
  jobs_30d: number;
  completed_jobs_1d: number;
  completed_jobs_7d: number;
  completed_jobs_30d: number;
  failed_jobs_1d: number;
  failed_jobs_7d: number;
  failed_jobs_30d: number;
  active_evaluators_1d: number;
  active_evaluators_7d: number;
  active_evaluators_30d: number;
  first_evaluations_1d: number;
  first_evaluations_7d: number;
  first_evaluations_30d: number;
  repeat_evaluators_1d: number;
  repeat_evaluators_7d: number;
  repeat_evaluators_30d: number;
  operational_jobs_1d: number;
  operational_jobs_7d: number;
  operational_jobs_30d: number;
  free_quota_used: number;
  exhausted_free_users: number;
  page_views_1d: number;
  page_views_7d: number;
  page_views_30d: number;
  evaluation_views_1d: number;
  evaluation_views_7d: number;
  evaluation_views_30d: number;
  auth_views_1d: number;
  auth_views_7d: number;
  auth_views_30d: number;
  cta_clicks_1d: number;
  cta_clicks_7d: number;
  cta_clicks_30d: number;
  guide_views_1d: number;
  guide_views_7d: number;
  guide_views_30d: number;
  guide_cta_clicks_1d: number;
  guide_cta_clicks_7d: number;
  guide_cta_clicks_30d: number;
  guide_continuation_clicks_1d: number;
  guide_continuation_clicks_7d: number;
  guide_continuation_clicks_30d: number;
  last_collection_date: string | null;
  last_indexed_at: Date | string | null;
}

interface DailySkillRow extends Record<string, unknown> {
  date: string;
  new_skills: number;
  collected_skills: number;
  total_skills: number;
}

interface UserCountRow extends Record<string, unknown> {
  total: number;
}

interface AdminUserRow extends Record<string, unknown> {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  role: "user" | "super_admin";
  joined_at: Date | string;
  last_active_at: Date | string | null;
  evaluation_jobs: number;
  completed_jobs: number;
  weekly_used: number;
  plan: "free" | "pro";
  weekly_limit: number;
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatPercent(value: number, total: number): string {
  return total > 0 ? `${Math.round((value / total) * 100)}%` : "0%";
}

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDateTime(value: Date | string | null): string {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value));
}

function adminPageHref(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/admin?${suffix}` : "/admin";
}

async function getSummary(): Promise<SummaryRow> {
  const result = await db.execute<SummaryRow>(sql`
    select
      (timezone('Asia/Shanghai', now())::date)::text as today,
      (select count(*)::int from "user") as total_users,
      (select count(*)::int from "user" where created_at >= now() - interval '1 day') as new_users_1d,
      (select count(*)::int from "user" where created_at >= now() - interval '7 days') as new_users_7d,
      (select count(*)::int from "user" where created_at >= now() - interval '30 days') as new_users_30d,
      (select count(*)::int from subscriptions where status = 'active' and (current_period_end is null or current_period_end > now())) as active_subscriptions,
      (select count(*)::int from skills where status = 'active') as active_skills,
      (select count(*)::int from skills where status = 'active' and type = 'claude-skill') as claude_skills,
      (select count(*)::int from skills where status = 'active' and type = 'mcp-server') as mcp_servers,
      (select count(*)::int from skills where status = 'active' and type = 'agent-pack') as agent_packs,
      (select count(*)::int from skills where (coalesce(first_seen_at, created_at) at time zone 'Asia/Shanghai')::date = timezone('Asia/Shanghai', now())::date) as new_skills_today,
      (select count(distinct skill_id)::int from metrics_daily where date = timezone('Asia/Shanghai', now())::date) as collected_skills_today,
      (select count(distinct skill_id)::int from evaluations) as evaluated_skills,
      (select count(*)::int from evaluations) as total_evaluations,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '1 day') as jobs_1d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '7 days') as jobs_7d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '30 days') as jobs_30d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '1 day' and status = 'done') as completed_jobs_1d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '7 days' and status = 'done') as completed_jobs_7d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '30 days' and status = 'done') as completed_jobs_30d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '1 day' and status = 'failed') as failed_jobs_1d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '7 days' and status = 'failed') as failed_jobs_7d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '30 days' and status = 'failed') as failed_jobs_30d,
      (select count(distinct user_id)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '1 day') as active_evaluators_1d,
      (select count(distinct user_id)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '7 days') as active_evaluators_7d,
      (select count(distinct user_id)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '30 days') as active_evaluators_30d,
      (select count(*)::int from (
        select user_id, min(created_at) as first_at from evaluation_jobs
        where user_id is not null and triggered_by = 'authenticated-user' and status = 'done' group by user_id
      ) firsts where first_at >= now() - interval '1 day') as first_evaluations_1d,
      (select count(*)::int from (
        select user_id, min(created_at) as first_at from evaluation_jobs
        where user_id is not null and triggered_by = 'authenticated-user' and status = 'done' group by user_id
      ) firsts where first_at >= now() - interval '7 days') as first_evaluations_7d,
      (select count(*)::int from (
        select user_id, min(created_at) as first_at from evaluation_jobs
        where user_id is not null and triggered_by = 'authenticated-user' and status = 'done' group by user_id
      ) firsts where first_at >= now() - interval '30 days') as first_evaluations_30d,
      (select count(distinct current_job.user_id)::int from evaluation_jobs current_job
        where current_job.user_id is not null and current_job.triggered_by = 'authenticated-user' and current_job.status = 'done'
          and current_job.created_at >= now() - interval '1 day'
          and exists (select 1 from evaluation_jobs prior where prior.user_id = current_job.user_id and prior.triggered_by = 'authenticated-user' and prior.status = 'done' and prior.created_at < current_job.created_at)) as repeat_evaluators_1d,
      (select count(distinct current_job.user_id)::int from evaluation_jobs current_job
        where current_job.user_id is not null and current_job.triggered_by = 'authenticated-user' and current_job.status = 'done'
          and current_job.created_at >= now() - interval '7 days'
          and exists (select 1 from evaluation_jobs prior where prior.user_id = current_job.user_id and prior.triggered_by = 'authenticated-user' and prior.status = 'done' and prior.created_at < current_job.created_at)) as repeat_evaluators_7d,
      (select count(distinct current_job.user_id)::int from evaluation_jobs current_job
        where current_job.user_id is not null and current_job.triggered_by = 'authenticated-user' and current_job.status = 'done'
          and current_job.created_at >= now() - interval '30 days'
          and exists (select 1 from evaluation_jobs prior where prior.user_id = current_job.user_id and prior.triggered_by = 'authenticated-user' and prior.status = 'done' and prior.created_at < current_job.created_at)) as repeat_evaluators_30d,
      (select count(*)::int from evaluation_jobs where (user_id is null or triggered_by is distinct from 'authenticated-user') and created_at >= now() - interval '1 day') as operational_jobs_1d,
      (select count(*)::int from evaluation_jobs where (user_id is null or triggered_by is distinct from 'authenticated-user') and created_at >= now() - interval '7 days') as operational_jobs_7d,
      (select count(*)::int from evaluation_jobs where (user_id is null or triggered_by is distinct from 'authenticated-user') and created_at >= now() - interval '30 days') as operational_jobs_30d,
      (select coalesce(sum(q.used), 0)::int from evaluation_quota_usage q
        where q.subject_type = 'user' and q.period_end > now()
          and not exists (select 1 from subscriptions s where s.user_id = q.subject_key and s.status = 'active' and (s.current_period_end is null or s.current_period_end > now()))) as free_quota_used,
      (select count(*)::int from evaluation_quota_usage q
        where q.subject_type = 'user' and q.period_end > now() and q.used >= q.quota_limit
          and not exists (select 1 from subscriptions s where s.user_id = q.subject_key and s.status = 'active' and (s.current_period_end is null or s.current_period_end > now()))) as exhausted_free_users,
      (select coalesce(sum(page_views), 0)::int from traffic_daily where date >= timezone('Asia/Shanghai', now())::date) as page_views_1d,
      (select coalesce(sum(page_views), 0)::int from traffic_daily where date >= timezone('Asia/Shanghai', now())::date - 6) as page_views_7d,
      (select coalesce(sum(page_views), 0)::int from traffic_daily where date >= timezone('Asia/Shanghai', now())::date - 29) as page_views_30d,
      (select coalesce(sum(page_views), 0)::int from traffic_daily where path = '/evaluation' and date >= timezone('Asia/Shanghai', now())::date) as evaluation_views_1d,
      (select coalesce(sum(page_views), 0)::int from traffic_daily where path = '/evaluation' and date >= timezone('Asia/Shanghai', now())::date - 6) as evaluation_views_7d,
      (select coalesce(sum(page_views), 0)::int from traffic_daily where path = '/evaluation' and date >= timezone('Asia/Shanghai', now())::date - 29) as evaluation_views_30d,
      (select coalesce(sum(page_views), 0)::int from traffic_daily where path = '/login' and date >= timezone('Asia/Shanghai', now())::date) as auth_views_1d,
      (select coalesce(sum(page_views), 0)::int from traffic_daily where path = '/login' and date >= timezone('Asia/Shanghai', now())::date - 6) as auth_views_7d,
      (select coalesce(sum(page_views), 0)::int from traffic_daily where path = '/login' and date >= timezone('Asia/Shanghai', now())::date - 29) as auth_views_30d,
      (select coalesce(sum(evaluation_cta_clicks), 0)::int from traffic_daily where date >= timezone('Asia/Shanghai', now())::date) as cta_clicks_1d,
      (select coalesce(sum(evaluation_cta_clicks), 0)::int from traffic_daily where date >= timezone('Asia/Shanghai', now())::date - 6) as cta_clicks_7d,
      (select coalesce(sum(evaluation_cta_clicks), 0)::int from traffic_daily where date >= timezone('Asia/Shanghai', now())::date - 29) as cta_clicks_30d,
      (select coalesce(sum(page_views), 0)::int from traffic_daily where path like '/guides/%' and date >= timezone('Asia/Shanghai', now())::date) as guide_views_1d,
      (select coalesce(sum(page_views), 0)::int from traffic_daily where path like '/guides/%' and date >= timezone('Asia/Shanghai', now())::date - 6) as guide_views_7d,
      (select coalesce(sum(page_views), 0)::int from traffic_daily where path like '/guides/%' and date >= timezone('Asia/Shanghai', now())::date - 29) as guide_views_30d,
      (select coalesce(sum(evaluation_cta_clicks), 0)::int from traffic_daily where path like '/guides/%' and date >= timezone('Asia/Shanghai', now())::date) as guide_cta_clicks_1d,
      (select coalesce(sum(evaluation_cta_clicks), 0)::int from traffic_daily where path like '/guides/%' and date >= timezone('Asia/Shanghai', now())::date - 6) as guide_cta_clicks_7d,
      (select coalesce(sum(evaluation_cta_clicks), 0)::int from traffic_daily where path like '/guides/%' and date >= timezone('Asia/Shanghai', now())::date - 29) as guide_cta_clicks_30d,
      (select coalesce(sum(guide_continuation_clicks), 0)::int from traffic_daily where path like '/guides/%' and date >= timezone('Asia/Shanghai', now())::date) as guide_continuation_clicks_1d,
      (select coalesce(sum(guide_continuation_clicks), 0)::int from traffic_daily where path like '/guides/%' and date >= timezone('Asia/Shanghai', now())::date - 6) as guide_continuation_clicks_7d,
      (select coalesce(sum(guide_continuation_clicks), 0)::int from traffic_daily where path like '/guides/%' and date >= timezone('Asia/Shanghai', now())::date - 29) as guide_continuation_clicks_30d,
      (select max(date)::text from metrics_daily) as last_collection_date,
      (select max(last_indexed_at) from skills) as last_indexed_at
  `);
  if (!result[0]) throw new Error("管理员统计查询未返回数据");
  return result[0];
}

async function getDailySkillSeries(): Promise<DailySkillCollectionPoint[]> {
  const result = await db.execute<DailySkillRow>(sql`
    with days as (
      select generate_series(
        timezone('Asia/Shanghai', now())::date - 29,
        timezone('Asia/Shanghai', now())::date,
        interval '1 day'
      )::date as day
    ), new_skills as (
      select (coalesce(first_seen_at, created_at) at time zone 'Asia/Shanghai')::date as day, count(*)::int as count
      from skills
      group by 1
    ), collected as (
      select date as day, count(distinct skill_id)::int as count
      from metrics_daily
      group by date
    )
    select
      days.day::text as date,
      coalesce(new_skills.count, 0)::int as new_skills,
      coalesce(collected.count, 0)::int as collected_skills,
      (
        select count(*)::int
        from skills
        where status = 'active'
          and (coalesce(first_seen_at, created_at) at time zone 'Asia/Shanghai')::date <= days.day
      ) as total_skills
    from days
    left join new_skills on new_skills.day = days.day
    left join collected on collected.day = days.day
    order by days.day
  `);

  return result.map((row) => ({
    date: row.date,
    newSkills: row.new_skills,
    collectedSkills: row.collected_skills,
    totalSkills: row.total_skills,
  }));
}

async function getUsers(query: string, page: number) {
  const pattern = `%${query}%`;
  const offset = (page - 1) * PAGE_SIZE;
  const [countResult, rows] = await Promise.all([
    db.execute<UserCountRow>(sql`
      select count(*)::int as total
      from "user" u
      where ${query} = '' or u.name ilike ${pattern} or u.email ilike ${pattern}
    `),
    db.execute<AdminUserRow>(sql`
      select
        u.id,
        u.name,
        u.email,
        u.email_verified,
        u.role,
        u.created_at as joined_at,
        greatest(
          u.updated_at,
          (select max(s.updated_at) from session s where s.user_id = u.id),
          (select max(j.created_at) from evaluation_jobs j where j.user_id = u.id)
        ) as last_active_at,
        (select count(*)::int from evaluation_jobs j where j.user_id = u.id) as evaluation_jobs,
        (select count(*)::int from evaluation_jobs j where j.user_id = u.id and j.status = 'done') as completed_jobs,
        coalesce((
          select q.used from evaluation_quota_usage q
          where q.subject_type = 'user' and q.subject_key = u.id and q.period_end > now()
          order by q.period_start desc limit 1
        ), 0)::int as weekly_used,
        case when exists (
          select 1 from subscriptions sub
          where sub.user_id = u.id and sub.status = 'active'
            and (sub.current_period_end is null or sub.current_period_end > now())
        ) then 'pro' else 'free' end as plan,
        coalesce((
          select sub.weekly_evaluation_limit from subscriptions sub
          where sub.user_id = u.id and sub.status = 'active'
            and (sub.current_period_end is null or sub.current_period_end > now())
          limit 1
        ), 10)::int as weekly_limit
      from "user" u
      where ${query} = '' or u.name ilike ${pattern} or u.email ilike ${pattern}
      order by u.created_at desc
      limit ${PAGE_SIZE} offset ${offset}
    `),
  ]);
  return { total: countResult[0]?.total ?? 0, rows };
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const session = await requireSuperAdmin("/admin");
  const params = await searchParams;
  const query = firstValue(params.q).trim().slice(0, 100);
  const parsedPage = Number.parseInt(firstValue(params.page), 10);
  const requestedPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [summary, dailySkills, initialUsers] = await Promise.all([
    getSummary(),
    getDailySkillSeries(),
    getUsers(query, requestedPage),
  ]);
  const totalPages = Math.max(1, Math.ceil(initialUsers.total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const usersResult = page === requestedPage ? initialUsers : await getUsers(query, page);
  const collectionIsCurrent = summary.last_collection_date === summary.today;
  const completionRate = formatPercent(summary.completed_jobs_7d, summary.jobs_7d);
  const evaluationCoverage = formatPercent(summary.evaluated_skills, summary.active_skills);
  const activationRate = formatPercent(summary.active_evaluators_7d, summary.total_users);
  const guideCtaRate = formatPercent(summary.guide_cta_clicks_7d, summary.guide_views_7d);
  const guideContinuationRate = formatPercent(summary.guide_continuation_clicks_7d, summary.guide_views_7d);
  const latestSevenDays = dailySkills.slice(-7).reverse();

  const headlineMetrics = [
    { label: "用户总数", value: summary.total_users, detail: `D1 +${summary.new_users_1d} · D7 +${summary.new_users_7d} · D30 +${summary.new_users_30d}`, icon: UsersRound },
    { label: "7 日页面浏览", value: summary.page_views_7d, detail: `D1 ${summary.page_views_1d} · D30 ${summary.page_views_30d}`, icon: Activity },
    { label: "评测页访问", value: summary.evaluation_views_7d, detail: `近 7 天 CTA ${summary.cta_clicks_7d} 次 · 登录/注册页 ${summary.auth_views_7d} 次`, icon: Gauge },
    { label: "指南引导评测", value: summary.guide_cta_clicks_7d, detail: `浏览 ${summary.guide_views_7d} · 继续阅读 ${summary.guide_continuation_clicks_7d}（${guideContinuationRate}）· CTA ${guideCtaRate}`, icon: BookOpenCheck },
    { label: "7 日活跃评测用户", value: summary.active_evaluators_7d, detail: `首评 ${summary.first_evaluations_7d} · 复评 ${summary.repeat_evaluators_7d} · 激活率 ${activationRate}`, icon: UserRoundCheck },
    { label: "有效订阅", value: summary.active_subscriptions, detail: `免费额度已用 ${summary.free_quota_used} 次 · 耗尽 ${summary.exhausted_free_users} 人`, icon: CircleDollarSign },
    { label: "Skill 库存", value: summary.active_skills, detail: `今日新增 ${summary.new_skills_today}`, icon: Database },
    { label: "今日采集覆盖", value: summary.collected_skills_today, detail: collectionIsCurrent ? "今日采集已写入" : "今日采集尚未写入", icon: RefreshCcw },
    { label: "评测覆盖率", value: evaluationCoverage, detail: `${summary.evaluated_skills} 个 Skill 有报告`, icon: ShieldCheck },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <section className="relative overflow-hidden rounded-[2rem] border bg-foreground px-6 py-8 text-background sm:px-9">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.28),transparent_42%)]" aria-hidden="true" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary"><Gauge className="h-4 w-4" /> Operations console</div>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-5xl">运营与用户数据</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-background/65">查看用户增长、评测转化与每天实际抓取到本站的 Skill。所有日期按北京时间统计。</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-background/75">
            <ShieldCheck className="h-4 w-4 text-emerald-400" /> {session.user.name} · 超级管理员
          </div>
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="border-b px-5 py-5 sm:px-7">
          <div className="flex items-center gap-2 font-bold"><Gauge className="h-4 w-4 text-primary" />增长漏斗 D1 / D7 / D30</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">页面浏览使用无 Cookie 日聚合统计；用户漏斗仅统计登录用户主动发起的评测，案例、重评与发布冒烟任务不计入增长。</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-muted/45 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-semibold sm:px-7">阶段</th><th className="px-4 py-3 text-right font-semibold">D1</th><th className="px-4 py-3 text-right font-semibold">D7</th><th className="px-5 py-3 text-right font-semibold sm:pr-7">D30</th></tr></thead>
            <tbody className="divide-y">
              {[
                ["页面浏览", summary.page_views_1d, summary.page_views_7d, summary.page_views_30d],
                ["指南页面浏览", summary.guide_views_1d, summary.guide_views_7d, summary.guide_views_30d],
                ["指南继续阅读点击", summary.guide_continuation_clicks_1d, summary.guide_continuation_clicks_7d, summary.guide_continuation_clicks_30d],
                ["指南评测 CTA", summary.guide_cta_clicks_1d, summary.guide_cta_clicks_7d, summary.guide_cta_clicks_30d],
                ["评测落地页访问", summary.evaluation_views_1d, summary.evaluation_views_7d, summary.evaluation_views_30d],
                ["评测 CTA 点击", summary.cta_clicks_1d, summary.cta_clicks_7d, summary.cta_clicks_30d],
                ["登录/注册页访问", summary.auth_views_1d, summary.auth_views_7d, summary.auth_views_30d],
                ["新增用户", summary.new_users_1d, summary.new_users_7d, summary.new_users_30d],
                ["首次成功评测", summary.first_evaluations_1d, summary.first_evaluations_7d, summary.first_evaluations_30d],
                ["重复评测用户", summary.repeat_evaluators_1d, summary.repeat_evaluators_7d, summary.repeat_evaluators_30d],
                ["活跃评测用户", summary.active_evaluators_1d, summary.active_evaluators_7d, summary.active_evaluators_30d],
                ["用户评测任务", summary.jobs_1d, summary.jobs_7d, summary.jobs_30d],
                ["运维评测（已排除）", summary.operational_jobs_1d, summary.operational_jobs_7d, summary.operational_jobs_30d],
              ].map(([label, d1, d7, d30]) => <tr key={String(label)}><td className="px-5 py-3 font-semibold sm:px-7">{label}</td><td className="px-4 py-3 text-right font-bold">{d1}</td><td className="px-4 py-3 text-right font-bold">{d7}</td><td className="px-5 py-3 text-right font-bold sm:pr-7">{d30}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {headlineMetrics.map(({ label, value, detail, icon: Icon }) => (
          <div key={label} className="surface-card p-5">
            <div className="flex items-center justify-between gap-4"><span className="text-xs font-bold text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary" /></div>
            <div className="mt-3 text-3xl font-black tracking-[-0.04em]">{typeof value === "number" ? value.toLocaleString("zh-CN") : value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
          </div>
        ))}
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:px-7">
          <div>
            <div className="flex items-center gap-2 font-bold"><Activity className="h-4 w-4 text-primary" />每日 Skill 采集</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">采集覆盖 = 当天写入指标的去重 Skill；新增收录 = 当天首次进入本站的 Skill。</p>
          </div>
          <div className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${collectionIsCurrent ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
            <span className={`h-2 w-2 rounded-full ${collectionIsCurrent ? "bg-emerald-500" : "bg-amber-500"}`} />
            {collectionIsCurrent ? "今日采集数据正常" : `最近采集 ${summary.last_collection_date ?? "暂无"}`}
          </div>
        </div>
        <div className="grid gap-0 xl:grid-cols-[1fr_360px]">
          <div className="min-w-0 border-b p-4 sm:p-6 xl:border-b-0 xl:border-r"><AdminCollectionChart data={dailySkills} /></div>
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between"><h2 className="text-sm font-bold">最近 7 天明细</h2><span className="text-[11px] text-muted-foreground">北京时间</span></div>
            <div className="mt-4 overflow-hidden rounded-xl border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground"><tr><th className="px-3 py-2.5 font-semibold">日期</th><th className="px-3 py-2.5 text-right font-semibold">采集</th><th className="px-3 py-2.5 text-right font-semibold">新增</th></tr></thead>
                <tbody className="divide-y">{latestSevenDays.map((row) => <tr key={row.date}><td className="px-3 py-2.5 font-medium">{row.date.slice(5)}</td><td className="px-3 py-2.5 text-right font-bold">{row.collectedSkills}</td><td className="px-3 py-2.5 text-right text-primary">+{row.newSkills}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="mt-4 rounded-xl bg-muted/45 p-3 text-xs leading-5 text-muted-foreground"><Clock3 className="mr-1.5 inline h-3.5 w-3.5" />最近索引时间：{formatDateTime(summary.last_indexed_at)}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="surface-card p-6">
          <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4 text-primary" />评测运营（近 7 天）</div>
          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            {[
              ["提交任务", summary.jobs_7d],
              ["完成任务", summary.completed_jobs_7d],
              ["失败任务", summary.failed_jobs_7d],
              ["完成率", completionRate],
            ].map(([label, value]) => <div key={String(label)}><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-black">{typeof value === "number" ? value.toLocaleString("zh-CN") : value}</div></div>)}
          </div>
        </div>
        <div className="surface-card p-6">
          <div className="flex items-center gap-2 font-bold"><Bot className="h-4 w-4 text-primary" />内容构成</div>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            {[["Skill", summary.claude_skills], ["MCP", summary.mcp_servers], ["Agent", summary.agent_packs]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-muted/45 px-2 py-4"><div className="text-2xl font-black">{value}</div><div className="mt-1 text-[11px] text-muted-foreground">{label}</div></div>)}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">近 30 天新增用户 {summary.new_users_30d} 人 · 累计生成 {summary.total_evaluations} 份报告</p>
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b px-5 py-5 sm:flex-row sm:items-end sm:px-7">
          <div><div className="flex items-center gap-2 font-bold"><UsersRound className="h-4 w-4 text-primary" />用户情况</div><p className="mt-1 text-xs text-muted-foreground">共 {usersResult.total} 个匹配账户，评测数据按账户归属统计。</p></div>
          <form action="/admin" method="get" className="flex w-full max-w-sm gap-2">
            <label className="relative min-w-0 flex-1"><span className="sr-only">搜索姓名或邮箱</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input name="q" defaultValue={query} maxLength={100} placeholder="搜索姓名或邮箱" className="h-10 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10" /></label>
            <button type="submit" className="button-primary h-10 px-4 text-sm">查询</button>
          </form>
        </div>
        {usersResult.rows.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-muted-foreground">没有找到匹配用户。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="bg-muted/45 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-semibold sm:px-7">用户</th><th className="px-4 py-3 font-semibold">身份</th><th className="px-4 py-3 font-semibold">套餐 / 本周</th><th className="px-4 py-3 text-right font-semibold">任务</th><th className="px-4 py-3 text-right font-semibold">完成</th><th className="px-4 py-3 font-semibold">最近活跃</th><th className="px-5 py-3 font-semibold sm:pr-7">注册时间</th></tr></thead>
              <tbody className="divide-y">{usersResult.rows.map((record) => (
                <tr key={record.id} className="hover:bg-muted/20">
                  <td className="px-5 py-4 sm:px-7"><div className="font-bold">{record.name}</div><div className="mt-1 max-w-64 truncate text-xs text-muted-foreground" title={record.email}>{record.email}</div></td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-1.5"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${record.role === "super_admin" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>{record.role === "super_admin" ? "超级管理员" : "用户"}</span>{record.email_verified && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-700">已验证</span>}</div></td>
                  <td className="px-4 py-4"><div className="font-semibold">{record.plan === "pro" ? "专业版" : "免费版"}</div><div className="mt-1 text-xs text-muted-foreground">{record.weekly_used} / {record.weekly_limit} 次</div></td>
                  <td className="px-4 py-4 text-right font-bold">{record.evaluation_jobs}</td>
                  <td className="px-4 py-4 text-right font-bold">{record.completed_jobs}</td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(record.last_active_at)}</td>
                  <td className="px-5 py-4 text-xs text-muted-foreground sm:pr-7">{formatDateTime(record.joined_at)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 border-t px-5 py-4 text-xs text-muted-foreground sm:px-7">
          <span>第 {page} / {totalPages} 页</span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={adminPageHref(page - 1, query)} className="inline-flex h-9 items-center gap-1 rounded-lg border bg-card px-3 font-bold text-foreground hover:border-primary/40"><ArrowLeft className="h-3.5 w-3.5" />上一页</Link> : <span className="inline-flex h-9 items-center gap-1 rounded-lg border px-3 opacity-40"><ArrowLeft className="h-3.5 w-3.5" />上一页</span>}
            {page < totalPages ? <Link href={adminPageHref(page + 1, query)} className="inline-flex h-9 items-center gap-1 rounded-lg border bg-card px-3 font-bold text-foreground hover:border-primary/40">下一页<ArrowRight className="h-3.5 w-3.5" /></Link> : <span className="inline-flex h-9 items-center gap-1 rounded-lg border px-3 opacity-40">下一页<ArrowRight className="h-3.5 w-3.5" /></span>}
          </div>
        </div>
      </section>
    </div>
  );
}
