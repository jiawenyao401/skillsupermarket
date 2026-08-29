import { sql } from "drizzle-orm";
import { db } from "./db";
import { normalizeCoverageBatchSize, SCHEDULED_COVERAGE_TRIGGER } from "./evaluation-queue-policy";

interface ScheduledCoverageRow extends Record<string, unknown> {
  id: string;
  skill_id: string;
}

/**
 * Atomically enqueue a small, bounded set of high-impact active projects that
 * have neither a report nor an active job. The partial unique index on active
 * jobs closes the remaining race with user-triggered submissions.
 */
export async function enqueueEvaluationCoverage(configuredBatchSize?: string): Promise<{
  batchSize: number;
  jobIds: string[];
}> {
  const batchSize = normalizeCoverageBatchSize(configuredBatchSize);
  if (batchSize === 0) return { batchSize, jobIds: [] };

  const rows = await db.execute<ScheduledCoverageRow>(sql`
    insert into evaluation_jobs (
      skill_id,
      status,
      triggered_by,
      attempt,
      max_attempts,
      progress,
      stage
    )
    select
      candidate.id,
      'pending',
      ${SCHEDULED_COVERAGE_TRIGGER},
      0,
      2,
      0,
      'coverage-queued'
    from skills candidate
    where candidate.status = 'active'
      and candidate.repo_url ~* '^https://github[.]com/[^/]+/[^/]+'
      and not exists (
        select 1 from evaluations existing_report
        where existing_report.skill_id = candidate.id
      )
      and not exists (
        select 1 from evaluation_jobs active_job
        where active_job.skill_id = candidate.id
          and active_job.status in ('pending', 'running')
      )
    order by coalesce(candidate.github_stars, 0) desc, candidate.created_at asc
    limit ${batchSize}
    on conflict do nothing
    returning id, skill_id
  `);

  return { batchSize, jobIds: rows.map((row) => row.id) };
}
