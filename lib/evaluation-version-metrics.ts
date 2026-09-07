import { sql } from "drizzle-orm";
import { growthPercentage } from "./growth-metrics";

export interface EvaluationVersionRow extends Record<string, unknown> {
  version: string | null;
  latest_reports: number;
  reports_1d: number;
  reports_7d: number;
  reports_30d: number;
}

// One query for both consumers. Latest inventory counts and historical output
// counts are different cohorts; never filter to the latest report before D1/D7/D30.
export function evaluationVersionMetricsQuery(now = new Date()) {
  const timestamp = now.toISOString();
  return sql`
    with active_reports as (
      select e.id, e.skill_id, e.evaluated_at,
        case when jsonb_typeof(e.report -> 'version') = 'string'
          and e.report ->> 'version' ~ '^[0-9]{1,4}[.][0-9]{1,4}[.][0-9]{1,4}$'
          then e.report ->> 'version' else null end as version
      from evaluations e join skills s on s.id = e.skill_id
      where s.status = 'active'
    ), latest as (
      select distinct on (skill_id) id from active_reports
      order by skill_id, evaluated_at desc nulls last, id desc
    )
    select r.version,
      count(*) filter (where l.id is not null)::int as latest_reports,
      count(*) filter (where r.evaluated_at >= ${timestamp}::timestamptz - interval '1 day'
        and r.evaluated_at <= ${timestamp}::timestamptz)::int as reports_1d,
      count(*) filter (where r.evaluated_at >= ${timestamp}::timestamptz - interval '7 days'
        and r.evaluated_at <= ${timestamp}::timestamptz)::int as reports_7d,
      count(*) filter (where r.evaluated_at >= ${timestamp}::timestamptz - interval '30 days'
        and r.evaluated_at <= ${timestamp}::timestamptz)::int as reports_30d
    from active_reports r left join latest l on l.id = r.id
    group by r.version order by r.version nulls last
  `;
}

export function summarizeEvaluationVersions(rows: EvaluationVersionRow[], currentVersion: string, activeSkills: number) {
  const versions = rows.map((row) => ({ version: row.version, latestReports: row.latest_reports,
    reports1d: row.reports_1d, reports7d: row.reports_7d, reports30d: row.reports_30d }));
  const latestReports = versions.reduce((sum, row) => sum + row.latestReports, 0);
  const currentVersionLatestReports = versions.find((row) => row.version === currentVersion)?.latestReports ?? 0;
  const unversionedLatestReports = versions.find((row) => row.version === null)?.latestReports ?? 0;
  return {
    currentVersion, activeSkills, latestReports, currentVersionLatestReports, unversionedLatestReports,
    otherVersionLatestReports: latestReports - currentVersionLatestReports - unversionedLatestReports,
    currentVersionCoverage: growthPercentage(currentVersionLatestReports, activeSkills),
    windowBasis: "rolling-evaluated-at" as const,
    reportSourceAttributionAvailable: false,
    versions,
  };
}

export type EvaluationVersionMetrics = ReturnType<typeof summarizeEvaluationVersions>;
