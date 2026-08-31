import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { SKILL_CLASSIFIER_VERSION } from "../lib/skill-classification";
import {
  planGitHubSkillReclassification,
  summarizeSkillTypeChanges,
  type ReclassifiableGitHubSkill,
} from "../lib/skill-reclassification";
import { evaluationJobs, skills } from "../lib/schema";
import type { SkillType } from "../lib/types";

const DEFAULT_MAX_CHANGES = 20;
const HARD_MAX_CHANGES = 50;
const TRIGGER = "operations-type-reclassification";

interface InventoryRow extends Record<string, unknown> {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  type: SkillType;
  has_evaluation: boolean;
}

function maxAllowedChanges(value: string | undefined): number {
  if (!value) return DEFAULT_MAX_CHANGES;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > HARD_MAX_CHANGES) {
    throw new Error(`TYPE_RECLASSIFY_MAX_CHANGES must be an integer from 1 to ${HARD_MAX_CHANGES}`);
  }
  return parsed;
}

async function loadInventory(): Promise<ReclassifiableGitHubSkill[]> {
  const rows = await db.execute<InventoryRow>(sql`
    select
      candidate.id,
      candidate.name,
      candidate.description,
      candidate.tags,
      candidate.type,
      exists (
        select 1 from evaluations report
        where report.skill_id = candidate.id
      ) as has_evaluation
    from skills candidate
    where candidate.status = 'active'
      and candidate.source = 'github'
    order by candidate.created_at asc, candidate.id asc
  `);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    tags: row.tags,
    type: row.type,
    hasEvaluation: row.has_evaluation,
  }));
}

async function main() {
  const execute = process.argv.slice(2).includes("--execute");
  const inventory = await loadInventory();
  const changes = planGitHubSkillReclassification(inventory);
  const maxChanges = maxAllowedChanges(process.env.TYPE_RECLASSIFY_MAX_CHANGES);

  if (changes.length > maxChanges) {
    throw new Error(`Refusing ${changes.length} changes; safety limit is ${maxChanges}`);
  }

  let updated = 0;
  let reEvaluationCandidates = 0;
  let queued = 0;
  if (execute) {
    await db.transaction(async (tx) => {
      for (const change of changes) {
        const updatedRows = await tx.update(skills).set({ type: change.to }).where(and(
          eq(skills.id, change.id),
          eq(skills.source, "github"),
          eq(skills.status, "active"),
          eq(skills.type, change.from),
        )).returning({ id: skills.id });
        if (updatedRows.length === 0) continue;
        updated += 1;

        if (change.hasEvaluation) {
          reEvaluationCandidates += 1;
          const jobs = await tx.insert(evaluationJobs).values({
            skillId: change.id,
            status: "pending",
            triggeredBy: TRIGGER,
            attempt: 0,
            maxAttempts: 2,
            progress: 0,
            stage: "type-reclassification",
            forceRefresh: true,
          }).onConflictDoNothing().returning({ id: evaluationJobs.id });
          queued += jobs.length;
        }
      }
    });
  }

  console.log(JSON.stringify({
    mode: execute ? "execute" : "dry-run",
    classifierVersion: SKILL_CLASSIFIER_VERSION,
    scanned: inventory.length,
    changes: changes.length,
    evaluatedChanges: changes.filter((change) => change.hasEvaluation).length,
    updated,
    queued,
    skippedActiveJobs: execute
      ? reEvaluationCandidates - queued
      : 0,
    transitions: summarizeSkillTypeChanges(changes),
  }));
}

main().catch((error) => {
  console.error("[type-reclassification] failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
