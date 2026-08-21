import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "../lib/db";
import {
  buildSummary,
  calculateOverallScore,
  clamp,
  combineQualityScore,
  EVALUATOR_VERSION,
  WEIGHTS,
} from "../lib/evaluation-scoring";
import { getReadme } from "../lib/github";
import { evaluations } from "../lib/schema";
import type { JudgeResult } from "../lib/judge";
import type { EvaluationReport, RiskLevel } from "../lib/types";
import { findSkillByEvaluationSource } from "../lib/skill-upsert";

const scoresSchema = z.object({
  utility: z.number().int().min(0).max(20),
  clarity: z.number().int().min(0).max(20),
  reusability: z.number().int().min(0).max(20),
  design: z.number().int().min(0).max(20),
  documentation: z.number().int().min(0).max(20),
});
const judgmentSchema = z.object({
  score: z.number().int().min(0).max(100),
  details: z.string().min(1).max(500),
  comment: z.string().min(1).max(240),
  scores: scoresSchema,
  strengths: z.array(z.string().min(1).max(120)).max(4),
  concerns: z.array(z.string().min(1).max(120)).max(4),
  bestFor: z.array(z.string().min(1).max(80)).max(4),
  avoidFor: z.array(z.string().min(1).max(80)).max(4),
  evidence: z.array(z.string().min(1).max(160)).min(2).max(5),
  model: z.string().min(1).max(100),
  rubricVersion: z.string().min(1).max(30),
});
const bundleSchema = z.object({
  formatVersion: z.literal(1),
  preparedAt: z.string().datetime(),
  cases: z.array(z.object({
    repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
    readmeSha256: z.string().regex(/^[a-f0-9]{64}$/),
    judgment: judgmentSchema,
  })).min(1).max(20),
});

function unique(items: string[], limit = 6): string[] {
  return items.filter((value, index, values) => value && values.indexOf(value) === index).slice(0, limit);
}

async function applyCase(entry: z.infer<typeof bundleSchema>["cases"][number]) {
  const readme = await getReadme(entry.repository);
  if (!readme) throw new Error(`${entry.repository}: README unavailable`);
  const currentHash = createHash("sha256").update(readme).digest("hex");
  if (currentHash !== entry.readmeSha256) throw new Error(`${entry.repository}: README changed after local judgment`);

  const skill = await findSkillByEvaluationSource({ kind: "github", fullName: entry.repository });
  if (!skill) throw new Error(`${entry.repository}: skill case not found`);
  const [evaluation] = await db.select().from(evaluations)
    .where(eq(evaluations.skillId, skill.id))
    .orderBy(desc(evaluations.evaluatedAt))
    .limit(1);
  if (!evaluation) throw new Error(`${entry.repository}: evaluation not found`);

  const report = evaluation.report as EvaluationReport;
  if (report.version !== EVALUATOR_VERSION) throw new Error(`${entry.repository}: expected evaluator ${EVALUATOR_VERSION}`);
  const judgment = entry.judgment as unknown as JudgeResult;
  const deterministic = report.quality.deterministicScore ?? evaluation.qualityScore;
  const qualityScore = combineQualityScore(deterministic, judgment.score);
  const risk = (report.security.riskLevel ?? report.summary?.riskLevel ?? "low") as RiskLevel;
  const overall = calculateOverallScore({
    documentation: evaluation.documentationScore,
    security: evaluation.securityScore,
    popularity: evaluation.popularityScore,
    activity: evaluation.activityScore,
    quality: qualityScore,
    riskLevel: risk,
  });
  const confidence = clamp((report.summary?.confidence ?? 50) + (report.methodology?.aiJudgeUsed ? 0 : 15));

  report.overall = overall;
  report.summary = buildSummary(overall, risk, confidence);
  report.quality = {
    ...report.quality,
    score: qualityScore,
    details: judgment.details,
    llmComment: judgment.comment,
    deterministicScore: deterministic,
    aiScore: judgment.score,
    subScores: judgment.scores,
    evidence: judgment.evidence,
  };
  report.recommendation = {
    strengths: unique([...(report.documentation.strengths ?? []), ...(risk === "low" ? ["未发现已知高风险模式"] : []), ...judgment.strengths]),
    concerns: unique([...(report.recommendation?.concerns ?? []), ...judgment.concerns]),
    bestFor: judgment.bestFor,
    avoidFor: judgment.avoidFor,
    nextActions: report.recommendation?.nextActions ?? [],
  };
  report.methodology = {
    ...(report.methodology ?? {
      evaluatorVersion: EVALUATOR_VERSION,
      evaluatedAt: new Date().toISOString(),
      sources: [],
      scannedFiles: [],
      scannedCharacters: 0,
      weights: WEIGHTS,
      limitations: [],
    }),
    aiJudgeUsed: true,
    aiJudgeModel: judgment.model,
    rubricVersion: judgment.rubricVersion,
    caseStudy: true,
  };

  await db.update(evaluations).set({
    overallScore: overall,
    qualityScore,
    report,
    evaluatedBy: `case-study:v${EVALUATOR_VERSION}:${judgment.model}`,
  }).where(eq(evaluations.id, evaluation.id));

  return { repository: entry.repository, slug: skill.slug, overall, qualityScore, aiScore: judgment.score, verdict: report.summary.verdictLabel };
}

async function main() {
  const inputPath = resolve(process.argv[2] ?? process.env.CASE_JUDGMENTS_PATH ?? "data/case-study-judgments.json");
  const bundle = bundleSchema.parse(JSON.parse(await readFile(inputPath, "utf8")));
  for (const entry of bundle.cases) console.log(JSON.stringify(await applyCase(entry)));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
