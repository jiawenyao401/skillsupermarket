import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { getRepo } from "../lib/github";
import { SKILL_CLASSIFIER_VERSION } from "../lib/skill-classification";
import {
  planGitHubSkillReclassification,
  summarizeSkillTypeChanges,
  type ReclassifiableGitHubSkill,
} from "../lib/skill-reclassification";
import { evaluationJobs, skills } from "../lib/schema";
import { parseEvaluationSource } from "../lib/source-parser";
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
  repo_url: string | null;
  has_evaluation: boolean;
}

interface InventorySkill extends ReclassifiableGitHubSkill {
  repoUrl: string | null;
}

function maxAllowedChanges(value: string | undefined): number {
  if (!value) return DEFAULT_MAX_CHANGES;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > HARD_MAX_CHANGES) {
    throw new Error(`TYPE_RECLASSIFY_MAX_CHANGES must be an integer from 1 to ${HARD_MAX_CHANGES}`);
  }
  return parsed;
}

async function loadInventory(): Promise<InventorySkill[]> {
  const rows = await db.execute<InventoryRow>(sql`
    select
      candidate.id,
      candidate.name,
      candidate.description,
      candidate.tags,
      candidate.type,
      candidate.repo_url,
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
    repoUrl: row.repo_url,
    hasEvaluation: row.has_evaluation,
  }));
}

async function verifyCandidatesWithGitHub(
  inventory: InventorySkill[],
): Promise<{ candidates: number; verified: ReclassifiableGitHubSkill[] }> {
  const preliminary = planGitHubSkillReclassification(inventory);
  const candidateIds = new Set(preliminary.map((change) => change.id));
  const verified: ReclassifiableGitHubSkill[] = [];

  for (const skill of inventory) {
    if (!candidateIds.has(skill.id)) continue;
    const source = parseEvaluationSource(skill.repoUrl ?? "");
    if (source?.kind !== "github") {
      throw new Error("A reclassification candidate has no canonical GitHub source");
    }
    const repo = await getRepo(source.fullName, true);
    if (!repo) throw new Error("A reclassification candidate repository is unavailable");
    verified.push({
      id: skill.id,
      name: repo.name,
      description: repo.description,
      tags: repo.topics,
      type: skill.type,
      hasEvaluation: skill.hasEvaluation,
    });
  }

  return { candidates: preliminary.length, verified };
}

async function main() {
  const execute = process.argv.slice(2).includes("--execute");
  const inventory = await loadInventory();
  const verification = await verifyCandidatesWithGitHub(inventory);
  const changes = planGitHubSkillReclassification(verification.verified);
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
    candidates: verification.candidates,
    verifiedWithGitHub: verification.verified.length,
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
