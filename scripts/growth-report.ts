import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../lib/db";

interface ContentRow extends Record<string, unknown> {
  active_skills: number;
  new_skills_1d: number;
  new_skills_7d: number;
  new_skills_30d: number;
  collected_skills_today: number;
  last_collection_date: string | null;
  evaluated_skills: number;
  total_evaluations: number;
  missing_descriptions: number;
  stale_skills: number;
}

interface UserRow extends Record<string, unknown> {
  total_users: number;
  new_users_1d: number;
  new_users_7d: number;
  new_users_30d: number;
}

interface JobRow extends Record<string, unknown> {
  jobs_1d: number;
  jobs_7d: number;
  jobs_30d: number;
  completed_1d: number;
  completed_7d: number;
  completed_30d: number;
  failed_1d: number;
  failed_7d: number;
  failed_30d: number;
  evaluators_1d: number;
  evaluators_7d: number;
  evaluators_30d: number;
  first_evaluations_1d: number;
  first_evaluations_7d: number;
  first_evaluations_30d: number;
  repeat_evaluators_1d: number;
  repeat_evaluators_7d: number;
  repeat_evaluators_30d: number;
  operational_jobs_1d: number;
  operational_jobs_7d: number;
  operational_jobs_30d: number;
  coverage_jobs_1d: number;
  coverage_jobs_7d: number;
  coverage_completed_7d: number;
  coverage_failed_7d: number;
}

interface MonetizationRow extends Record<string, unknown> {
  active_subscriptions: number;
  free_quota_users: number;
  free_quota_used: number;
  exhausted_free_users: number;
}

interface TrafficRow extends Record<string, unknown> {
  page_views_1d: number;
  page_views_7d: number;
  page_views_30d: number;
  evaluation_views_1d: number;
  evaluation_views_7d: number;
  evaluation_views_30d: number;
  cta_clicks_1d: number;
  cta_clicks_7d: number;
  cta_clicks_30d: number;
  organic_views_7d: number;
  community_views_7d: number;
  github_views_7d: number;
}

interface DiagramRow extends Record<string, unknown> {
  latest_reports: number;
  ai_judged_reports: number;
  ai_judged_diagram_reports: number;
  ai_judged_reports_1d: number;
  ai_judged_diagram_reports_1d: number;
  flow_diagrams: number;
  sequence_diagrams: number;
  architecture_diagrams: number;
}

function percentage(value: number, total: number): string {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";
}

async function tableExists(name: string): Promise<boolean> {
  const result = await db.execute<{ exists: boolean }>(sql`
    select to_regclass(${`public.${name}`}) is not null as exists
  `);
  return result[0]?.exists ?? false;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const result = await db.execute<{ exists: boolean }>(sql`
    select exists(
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = ${table} and column_name = ${column}
    ) as exists
  `);
  return result[0]?.exists ?? false;
}

async function main() {
  const contentResult = await db.execute<ContentRow>(sql`
    select
      (select count(*)::int from skills where status = 'active') as active_skills,
      (select count(*)::int from skills where coalesce(first_seen_at, created_at) >= now() - interval '1 day') as new_skills_1d,
      (select count(*)::int from skills where coalesce(first_seen_at, created_at) >= now() - interval '7 days') as new_skills_7d,
      (select count(*)::int from skills where coalesce(first_seen_at, created_at) >= now() - interval '30 days') as new_skills_30d,
      (select count(distinct skill_id)::int from metrics_daily where date = timezone('Asia/Shanghai', now())::date) as collected_skills_today,
      (select max(date)::text from metrics_daily) as last_collection_date,
      (select count(distinct skill_id)::int from evaluations) as evaluated_skills,
      (select count(*)::int from evaluations) as total_evaluations,
      (select count(*)::int from skills where status = 'active' and (description is null or length(trim(description)) < 40)) as missing_descriptions,
      (select count(*)::int from skills where status = 'active' and coalesce(last_updated_at, created_at) < now() - interval '30 days') as stale_skills
  `);
  const content = contentResult[0];
  if (!content) throw new Error("增长报表内容查询未返回数据");

  const diagramResult = await db.execute<DiagramRow>(sql`
    with latest_reports as (
      select distinct on (skill_id) report, evaluated_at
      from evaluations
      order by skill_id, evaluated_at desc nulls last, id desc
    )
    select
      count(*)::int as latest_reports,
      count(*) filter (where report #>> '{methodology,aiJudgeUsed}' = 'true')::int as ai_judged_reports,
      count(*) filter (
        where report #>> '{methodology,aiJudgeUsed}' = 'true'
          and jsonb_typeof(report -> 'diagram') = 'object'
      )::int as ai_judged_diagram_reports,
      count(*) filter (
        where evaluated_at >= now() - interval '1 day'
          and report #>> '{methodology,aiJudgeUsed}' = 'true'
      )::int as ai_judged_reports_1d,
      count(*) filter (
        where evaluated_at >= now() - interval '1 day'
          and report #>> '{methodology,aiJudgeUsed}' = 'true'
          and jsonb_typeof(report -> 'diagram') = 'object'
      )::int as ai_judged_diagram_reports_1d,
      count(*) filter (where report #>> '{diagram,type}' = 'flow')::int as flow_diagrams,
      count(*) filter (where report #>> '{diagram,type}' = 'sequence')::int as sequence_diagrams,
      count(*) filter (where report #>> '{diagram,type}' = 'architecture')::int as architecture_diagrams
    from latest_reports
  `);
  const diagrams = diagramResult[0];
  if (!diagrams) throw new Error("增长报表图示查询未返回数据");

  const [hasUsers, hasJobs, hasJobUsers, hasJobSources, hasSubscriptions, hasQuota, hasTraffic] = await Promise.all([
    tableExists("user"),
    tableExists("evaluation_jobs"),
    columnExists("evaluation_jobs", "user_id"),
    columnExists("evaluation_jobs", "triggered_by"),
    tableExists("subscriptions"),
    tableExists("evaluation_quota_usage"),
    tableExists("traffic_daily"),
  ]);

  const users = hasUsers ? (await db.execute<UserRow>(sql`
    select
      count(*)::int as total_users,
      count(*) filter (where created_at >= now() - interval '1 day')::int as new_users_1d,
      count(*) filter (where created_at >= now() - interval '7 days')::int as new_users_7d,
      count(*) filter (where created_at >= now() - interval '30 days')::int as new_users_30d
    from "user"
  `))[0] : undefined;

  const jobs = hasJobs && hasJobUsers && hasJobSources ? (await db.execute<JobRow>(sql`
    select
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '1 day') as jobs_1d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '7 days') as jobs_7d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '30 days') as jobs_30d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '1 day' and status = 'done') as completed_1d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '7 days' and status = 'done') as completed_7d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '30 days' and status = 'done') as completed_30d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '1 day' and status = 'failed') as failed_1d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '7 days' and status = 'failed') as failed_7d,
      (select count(*)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '30 days' and status = 'failed') as failed_30d,
      (select count(distinct user_id)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '1 day') as evaluators_1d,
      (select count(distinct user_id)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '7 days') as evaluators_7d,
      (select count(distinct user_id)::int from evaluation_jobs where user_id is not null and triggered_by = 'authenticated-user' and created_at >= now() - interval '30 days') as evaluators_30d,
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
      (select count(*)::int from evaluation_jobs where triggered_by = 'scheduled-coverage' and created_at >= now() - interval '1 day') as coverage_jobs_1d,
      (select count(*)::int from evaluation_jobs where triggered_by = 'scheduled-coverage' and created_at >= now() - interval '7 days') as coverage_jobs_7d,
      (select count(*)::int from evaluation_jobs where triggered_by = 'scheduled-coverage' and created_at >= now() - interval '7 days' and status = 'done') as coverage_completed_7d,
      (select count(*)::int from evaluation_jobs where triggered_by = 'scheduled-coverage' and created_at >= now() - interval '7 days' and status = 'failed') as coverage_failed_7d
  `))[0] : hasJobs ? (await db.execute<JobRow>(sql`
    select
      count(*) filter (where created_at >= now() - interval '1 day')::int as jobs_1d,
      count(*) filter (where created_at >= now() - interval '7 days')::int as jobs_7d,
      count(*) filter (where created_at >= now() - interval '30 days')::int as jobs_30d,
      count(*) filter (where created_at >= now() - interval '1 day' and status = 'done')::int as completed_1d,
      count(*) filter (where created_at >= now() - interval '7 days' and status = 'done')::int as completed_7d,
      count(*) filter (where created_at >= now() - interval '30 days' and status = 'done')::int as completed_30d,
      count(*) filter (where created_at >= now() - interval '1 day' and status = 'failed')::int as failed_1d,
      count(*) filter (where created_at >= now() - interval '7 days' and status = 'failed')::int as failed_7d,
      count(*) filter (where created_at >= now() - interval '30 days' and status = 'failed')::int as failed_30d,
      0::int as evaluators_1d,
      0::int as evaluators_7d,
      0::int as evaluators_30d,
      0::int as first_evaluations_1d,
      0::int as first_evaluations_7d,
      0::int as first_evaluations_30d,
      0::int as repeat_evaluators_1d,
      0::int as repeat_evaluators_7d,
      0::int as repeat_evaluators_30d,
      count(*) filter (where created_at >= now() - interval '1 day')::int as operational_jobs_1d,
      count(*) filter (where created_at >= now() - interval '7 days')::int as operational_jobs_7d,
      count(*) filter (where created_at >= now() - interval '30 days')::int as operational_jobs_30d,
      0::int as coverage_jobs_1d,
      0::int as coverage_jobs_7d,
      0::int as coverage_completed_7d,
      0::int as coverage_failed_7d
    from evaluation_jobs
  `))[0] : undefined;

  const monetization = hasSubscriptions && hasQuota ? (await db.execute<MonetizationRow>(sql`
    select
      (select count(*)::int from subscriptions where status = 'active' and (current_period_end is null or current_period_end > now())) as active_subscriptions,
      count(distinct q.subject_key) filter (where q.subject_type = 'user')::int as free_quota_users,
      coalesce(sum(q.used) filter (where q.subject_type = 'user'), 0)::int as free_quota_used,
      count(*) filter (where q.subject_type = 'user' and q.used >= q.quota_limit)::int as exhausted_free_users
    from evaluation_quota_usage q
    where q.period_end > now()
      and not exists (
        select 1 from subscriptions s
        where s.user_id = q.subject_key and s.status = 'active'
          and (s.current_period_end is null or s.current_period_end > now())
      )
  `))[0] : undefined;

  const traffic = hasTraffic ? (await db.execute<TrafficRow>(sql`
    select
      coalesce(sum(page_views) filter (where date >= timezone('Asia/Shanghai', now())::date), 0)::int as page_views_1d,
      coalesce(sum(page_views) filter (where date >= timezone('Asia/Shanghai', now())::date - 6), 0)::int as page_views_7d,
      coalesce(sum(page_views) filter (where date >= timezone('Asia/Shanghai', now())::date - 29), 0)::int as page_views_30d,
      coalesce(sum(page_views) filter (where path = '/evaluation' and date >= timezone('Asia/Shanghai', now())::date), 0)::int as evaluation_views_1d,
      coalesce(sum(page_views) filter (where path = '/evaluation' and date >= timezone('Asia/Shanghai', now())::date - 6), 0)::int as evaluation_views_7d,
      coalesce(sum(page_views) filter (where path = '/evaluation' and date >= timezone('Asia/Shanghai', now())::date - 29), 0)::int as evaluation_views_30d,
      coalesce(sum(evaluation_cta_clicks) filter (where date >= timezone('Asia/Shanghai', now())::date), 0)::int as cta_clicks_1d,
      coalesce(sum(evaluation_cta_clicks) filter (where date >= timezone('Asia/Shanghai', now())::date - 6), 0)::int as cta_clicks_7d,
      coalesce(sum(evaluation_cta_clicks) filter (where date >= timezone('Asia/Shanghai', now())::date - 29), 0)::int as cta_clicks_30d,
      coalesce(sum(page_views) filter (where source = 'organic' and date >= timezone('Asia/Shanghai', now())::date - 6), 0)::int as organic_views_7d,
      coalesce(sum(page_views) filter (where source = 'community' and date >= timezone('Asia/Shanghai', now())::date - 6), 0)::int as community_views_7d,
      coalesce(sum(page_views) filter (where source = 'github' and date >= timezone('Asia/Shanghai', now())::date - 6), 0)::int as github_views_7d
    from traffic_daily
  `))[0] : undefined;

  const totalUsers = users?.total_users ?? 0;
  const jobs1d = jobs?.jobs_1d ?? 0;
  const jobs7d = jobs?.jobs_7d ?? 0;
  const jobs30d = jobs?.jobs_30d ?? 0;
  const report = {
    generatedAt: new Date().toISOString(),
    acquisition: {
      usersAvailable: hasUsers,
      trafficAvailable: hasTraffic,
      totalUsers,
      newUsers1d: users?.new_users_1d ?? 0,
      newUsers7d: users?.new_users_7d ?? 0,
      newUsers30d: users?.new_users_30d ?? 0,
      pageViews1d: traffic?.page_views_1d ?? 0,
      pageViews7d: traffic?.page_views_7d ?? 0,
      pageViews30d: traffic?.page_views_30d ?? 0,
      evaluationViews1d: traffic?.evaluation_views_1d ?? 0,
      evaluationViews7d: traffic?.evaluation_views_7d ?? 0,
      evaluationViews30d: traffic?.evaluation_views_30d ?? 0,
      evaluationCtaClicks1d: traffic?.cta_clicks_1d ?? 0,
      evaluationCtaClicks7d: traffic?.cta_clicks_7d ?? 0,
      evaluationCtaClicks30d: traffic?.cta_clicks_30d ?? 0,
      sourceViews7d: {
        organic: traffic?.organic_views_7d ?? 0,
        community: traffic?.community_views_7d ?? 0,
        github: traffic?.github_views_7d ?? 0,
      },
    },
    activation: {
      available: hasJobs,
      userAttributionAvailable: hasJobUsers,
      operationsExcluded: hasJobUsers && hasJobSources,
      evaluationJobs1d: jobs1d,
      evaluationJobs7d: jobs7d,
      evaluationJobs30d: jobs30d,
      completed1d: jobs?.completed_1d ?? 0,
      completed7d: jobs?.completed_7d ?? 0,
      completed30d: jobs?.completed_30d ?? 0,
      failed1d: jobs?.failed_1d ?? 0,
      failed7d: jobs?.failed_7d ?? 0,
      failed30d: jobs?.failed_30d ?? 0,
      uniqueEvaluators1d: jobs?.evaluators_1d ?? 0,
      uniqueEvaluators7d: jobs?.evaluators_7d ?? 0,
      uniqueEvaluators30d: jobs?.evaluators_30d ?? 0,
      firstEvaluations1d: jobs?.first_evaluations_1d ?? 0,
      firstEvaluations7d: jobs?.first_evaluations_7d ?? 0,
      firstEvaluations30d: jobs?.first_evaluations_30d ?? 0,
      repeatEvaluators1d: jobs?.repeat_evaluators_1d ?? 0,
      repeatEvaluators7d: jobs?.repeat_evaluators_7d ?? 0,
      repeatEvaluators30d: jobs?.repeat_evaluators_30d ?? 0,
      operationalJobs1d: jobs?.operational_jobs_1d ?? 0,
      operationalJobs7d: jobs?.operational_jobs_7d ?? 0,
      operationalJobs30d: jobs?.operational_jobs_30d ?? 0,
      coverageJobs1d: jobs?.coverage_jobs_1d ?? 0,
      coverageJobs7d: jobs?.coverage_jobs_7d ?? 0,
      coverageCompleted7d: jobs?.coverage_completed_7d ?? 0,
      coverageFailed7d: jobs?.coverage_failed_7d ?? 0,
      coverageCompletionRate7d: percentage(jobs?.coverage_completed_7d ?? 0, jobs?.coverage_jobs_7d ?? 0),
      completionRate1d: percentage(jobs?.completed_1d ?? 0, jobs1d),
      completionRate7d: percentage(jobs?.completed_7d ?? 0, jobs7d),
      completionRate30d: percentage(jobs?.completed_30d ?? 0, jobs30d),
    },
    monetization: {
      available: hasSubscriptions && hasQuota,
      upgradeTrackingAvailable: false,
      activeSubscriptions: monetization?.active_subscriptions ?? 0,
      freeQuotaUsers: monetization?.free_quota_users ?? 0,
      freeQuotaUsed: monetization?.free_quota_used ?? 0,
      exhaustedFreeUsers: monetization?.exhausted_free_users ?? 0,
    },
    inventory: {
      activeSkills: content.active_skills,
      newSkills1d: content.new_skills_1d,
      newSkills7d: content.new_skills_7d,
      newSkills30d: content.new_skills_30d,
      collectedSkillsToday: content.collected_skills_today,
      lastCollectionDate: content.last_collection_date,
      evaluatedSkills: content.evaluated_skills,
      totalEvaluations: content.total_evaluations,
      evaluationCoverage: percentage(content.evaluated_skills, content.active_skills),
      thinDescriptions: content.missing_descriptions,
      staleSkills30d: content.stale_skills,
    },
    evaluationQuality: {
      latestReports: diagrams.latest_reports,
      aiJudgedReports: diagrams.ai_judged_reports,
      diagramReports: diagrams.ai_judged_diagram_reports,
      diagramCoverage: percentage(diagrams.ai_judged_diagram_reports, diagrams.ai_judged_reports),
      aiJudgedReports1d: diagrams.ai_judged_reports_1d,
      diagramReports1d: diagrams.ai_judged_diagram_reports_1d,
      diagramCoverage1d: percentage(diagrams.ai_judged_diagram_reports_1d, diagrams.ai_judged_reports_1d),
      diagramTypes: {
        flow: diagrams.flow_diagrams,
        sequence: diagrams.sequence_diagrams,
        architecture: diagrams.architecture_diagrams,
      },
    },
  };

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("[growth] Skill Supermarket 真实增长与变现报表");
  console.log(hasUsers
    ? `[growth] 用户: 总计 ${totalUsers}，D1 +${report.acquisition.newUsers1d} / D7 +${report.acquisition.newUsers7d} / D30 +${report.acquisition.newUsers30d}`
    : "[growth] 用户: 数据不可用（用户表尚未部署）");
  console.log(hasTraffic
    ? `[growth] 访问: D1 ${report.acquisition.pageViews1d} / D7 ${report.acquisition.pageViews7d} / D30 ${report.acquisition.pageViews30d} 次页面浏览；评测页 D7 ${report.acquisition.evaluationViews7d}，CTA D7 ${report.acquisition.evaluationCtaClicks7d}`
    : "[growth] 访问: 数据不可用（隐私友好流量表尚未部署）");
  console.log(hasJobs
    ? `[growth] 激活: D1 ${jobs1d} / D7 ${jobs7d} / D30 ${jobs30d} 次用户任务；D7 首评 ${report.activation.firstEvaluations7d} 人、复评 ${report.activation.repeatEvaluators7d} 人、完成率 ${report.activation.completionRate7d}；另排除运维任务 ${report.activation.operationalJobs7d} 次`
    : "[growth] 激活: 数据不可用（评测任务表尚未部署）");
  if (hasJobs && hasJobSources) {
    console.log(`[growth] 覆盖调度: D1 ${report.activation.coverageJobs1d} / D7 ${report.activation.coverageJobs7d} 个任务；D7 完成率 ${report.activation.coverageCompletionRate7d}，失败 ${report.activation.coverageFailed7d}`);
  }
  console.log(report.monetization.available
    ? `[growth] 变现: ${report.monetization.activeSubscriptions} 个有效订阅，${report.monetization.freeQuotaUsers} 位免费用户本周已用 ${report.monetization.freeQuotaUsed} 次，${report.monetization.exhaustedFreeUsers} 位已耗尽额度`
    : "[growth] 变现: 数据不可用（订阅或额度表尚未部署）");
  console.log(`[growth] 库存: ${content.active_skills} 个有效项目，D1 +${content.new_skills_1d} / D7 +${content.new_skills_7d} / D30 +${content.new_skills_30d}，今日采集 ${content.collected_skills_today}，最近采集 ${content.last_collection_date ?? "暂无"}`);
  console.log(`[growth] 报告: ${content.evaluated_skills}/${content.active_skills} 个项目有报告，覆盖率 ${report.inventory.evaluationCoverage}，累计 ${content.total_evaluations} 份`);
  console.log(`[growth] 图示: ${report.evaluationQuality.diagramReports}/${report.evaluationQuality.aiJudgedReports} 份 AI 复核报告有图，覆盖率 ${report.evaluationQuality.diagramCoverage}；D1 ${report.evaluationQuality.diagramReports1d}/${report.evaluationQuality.aiJudgedReports1d}（${report.evaluationQuality.diagramCoverage1d}）；流程 ${report.evaluationQuality.diagramTypes.flow} / 时序 ${report.evaluationQuality.diagramTypes.sequence} / 架构 ${report.evaluationQuality.diagramTypes.architecture}`);
}

main().catch((error) => {
  console.error("[growth] 报表失败", error);
  process.exit(1);
});
