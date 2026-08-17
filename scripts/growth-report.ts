import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../lib/db";

interface ContentRow extends Record<string, unknown> {
  active_skills: number;
  evaluated_skills: number;
  missing_descriptions: number;
  stale_skills: number;
}

interface UserRow extends Record<string, unknown> {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
}

interface JobRow extends Record<string, unknown> {
  jobs_7d: number;
  jobs_30d: number;
  completed_7d: number;
}

interface EvaluatorRow extends Record<string, unknown> {
  evaluators_7d: number;
}

function percentage(value: number, total: number): string {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";
}

async function tableExists(name: "user" | "evaluation_jobs"): Promise<boolean> {
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
      (select count(distinct skill_id)::int from evaluations) as evaluated_skills,
      (select count(*)::int from skills where status = 'active' and (description is null or length(trim(description)) < 40)) as missing_descriptions,
      (select count(*)::int from skills where status = 'active' and coalesce(last_updated_at, created_at) < now() - interval '30 days') as stale_skills
  `);
  const content = contentResult[0];
  if (!content) throw new Error("增长报表内容查询未返回数据");

  const [hasUsers, hasJobs, hasJobUsers] = await Promise.all([
    tableExists("user"),
    tableExists("evaluation_jobs"),
    columnExists("evaluation_jobs", "user_id"),
  ]);
  const users = hasUsers
    ? (await db.execute<UserRow>(sql`
      select
        count(*)::int as total_users,
        count(*) filter (where created_at >= now() - interval '7 days')::int as new_users_7d,
        count(*) filter (where created_at >= now() - interval '30 days')::int as new_users_30d
      from "user"
    `))[0]
    : undefined;
  const jobs = hasJobs
    ? (await db.execute<JobRow>(sql`
      select
        count(*) filter (where created_at >= now() - interval '7 days')::int as jobs_7d,
        count(*) filter (where created_at >= now() - interval '30 days')::int as jobs_30d,
        count(*) filter (where created_at >= now() - interval '7 days' and status = 'done')::int as completed_7d
      from evaluation_jobs
    `))[0]
    : undefined;
  const evaluators = hasJobUsers
    ? (await db.execute<EvaluatorRow>(sql`
      select count(distinct user_id) filter (
        where created_at >= now() - interval '7 days' and user_id is not null
      )::int as evaluators_7d
      from evaluation_jobs
    `))[0]
    : undefined;

  const totalUsers = users?.total_users ?? 0;
  const newUsers7d = users?.new_users_7d ?? 0;
  const newUsers30d = users?.new_users_30d ?? 0;
  const jobs7d = jobs?.jobs_7d ?? 0;
  const jobs30d = jobs?.jobs_30d ?? 0;
  const evaluators7d = evaluators?.evaluators_7d ?? 0;
  const completed7d = jobs?.completed_7d ?? 0;

  const report = {
    generatedAt: new Date().toISOString(),
    acquisition: {
      available: hasUsers,
      totalUsers,
      newUsers7d,
      newUsers30d,
    },
    activation: {
      available: hasJobs,
      userAttributionAvailable: hasJobUsers,
      evaluationJobs7d: jobs7d,
      evaluationJobs30d: jobs30d,
      uniqueEvaluators7d: evaluators7d,
      completed7d,
      completionRate7d: percentage(completed7d, jobs7d),
    },
    seoInventory: {
      activeSkills: content.active_skills,
      evaluatedSkills: content.evaluated_skills,
      evaluationCoverage: percentage(content.evaluated_skills, content.active_skills),
      thinDescriptions: content.missing_descriptions,
      staleSkills30d: content.stale_skills,
    },
  };

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("[growth] Skill Supermarket 增长与内容库存");
  console.log(hasUsers
    ? `[growth] 用户: 总计 ${totalUsers}，近 7 天 +${newUsers7d}，近 30 天 +${newUsers30d}`
    : "[growth] 用户: 当前数据库尚未迁移用户表，部署迁移后开始统计");
  console.log(hasJobs
    ? `[growth] 激活: 近 7 天 ${jobs7d} 次任务${hasJobUsers ? ` / ${evaluators7d} 位用户` : "（旧表尚无用户归因）"}，完成率 ${report.activation.completionRate7d}`
    : "[growth] 激活: 当前数据库尚未迁移评测任务表，部署迁移后开始统计");
  console.log(`[growth] SEO: ${content.active_skills} 个公开 Skill，${content.evaluated_skills} 个有报告，覆盖率 ${report.seoInventory.evaluationCoverage}`);
  console.log(`[growth] 内容债务: ${content.missing_descriptions} 个简介过短，${content.stale_skills} 个超过 30 天未更新`);
}

main().catch((error) => {
  console.error("[growth] 报表失败", error);
  process.exit(1);
});
