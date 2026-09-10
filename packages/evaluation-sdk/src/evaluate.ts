import { z } from "zod";
import {
  buildSummary, calculateConfidenceBreakdown, calculateEffectiveReadmeEvidenceCharacters,
  calculateOverallScore, combineQualityScore, countIndependentEvidenceSources,
  deterministicQualityScore, EVALUATOR_VERSION, scoreActivity, scoreDocumentation,
  scorePopularity, WEIGHTS,
} from "./evaluation-scoring.ts";
import { EvaluationError, throwIfAborted, type EvaluationErrorCode } from "./errors.ts";
import { inferDocumentKind, parseEvaluationInput, timestampSchema, type EvaluationInput } from "./input.ts";
import { normalizeEvaluationDiagram, validateJudgeCalibration, type JudgeResult } from "./judge.ts";
import type { Judge } from "./llm-judge.ts";
import { redactKnownSecrets } from "./redaction.ts";
import { scanDocuments } from "./scanner.ts";
import type { EvaluationReport, EvaluationSummary, EvaluationRecommendation, EvaluationMethodology } from "./types.ts";

export type CompletedEvaluationReport = EvaluationReport & {
  version: string;
  summary: EvaluationSummary;
  recommendation: EvaluationRecommendation;
  methodology: EvaluationMethodology;
};
export type EvaluationStage = "security" | "quality" | "report";
export interface EvaluationOptions {
  /** Omit for offline evaluation; custom adapters are trusted application code. */
  judge?: Judge;
  aiPolicy?: "optional" | "required" | "disabled";
  /** ISO timestamp used for BOTH activity scoring and report time. */
  evaluatedAt?: string;
  signal?: AbortSignal;
  /** Whole AI phase, including optional diagram recovery. Default: 65s. */
  judgeTimeoutMs?: number;
  /** Awaited; a failing callback rejects the evaluation, never silently ignored. */
  onStage?: (stage: EvaluationStage) => void | Promise<void>;
}
export interface EvaluationResult {
  report: CompletedEvaluationReport;
  diagnostics: {
    aiStatus: "completed" | "disabled" | "unconfigured" | "failed";
    aiErrorCode?: EvaluationErrorCode;
  };
}

const score = z.number().int().min(0).max(20);
const boundedText = z.string().min(1).max(1000).transform(redactKnownSecrets);
const texts = z.array(boundedText).max(20);
const judgeResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  scores: z.object({ utility: score, clarity: score, reusability: score, design: score, documentation: score }),
  details: boundedText, comment: boundedText,
  strengths: texts, concerns: texts, bestFor: texts, avoidFor: texts,
  evidence: texts.min(2), calibrationNotes: texts,
  diagram: z.unknown().optional(),
  diagramStatus: z.enum(["generated", "insufficient-evidence", "invalid-output"]),
  diagramRejectionReason: z.enum(["schema-constraint", "duplicate-node", "unknown-node", "self-loop", "duplicate-edge", "unconnected-node", "disconnected-graph"]).optional(),
  diagramRecoveryAttempted: z.boolean(),
  diagramRecoveryStatus: z.enum(["not-needed", "not-eligible", "generated", "insufficient-evidence", "invalid-output", "unavailable"]),
  model: boundedText, rubricVersion: boundedText,
});

async function invokeJudge(judge: Judge, input: Parameters<Judge>[0], signal: AbortSignal | undefined, timeoutMs: number): Promise<JudgeResult> {
  const controller = new AbortController();
  let rejectWait: (error: EvaluationError) => void = () => undefined;
  const interrupted = new Promise<never>((_, reject) => { rejectWait = reject; });
  const abort = () => { controller.abort(); rejectWait(new EvaluationError("ABORTED")); };
  const timer = setTimeout(() => { controller.abort(); rejectWait(new EvaluationError("JUDGE_TIMEOUT")); }, timeoutMs);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    throwIfAborted(signal);
    // Promise.resolve also captures synchronous adapter failures. Late results
    // remain observed by race; an adapter ignoring cancellation cannot persist.
    const raw = await Promise.race([Promise.resolve().then(() => judge(input, { signal: controller.signal })), interrupted]);
    throwIfAborted(signal);
    const parsed = judgeResultSchema.parse(raw);
    if (parsed.score !== Object.values(parsed.scores).reduce((a, b) => a + b, 0)) throw new Error("Inconsistent total");
    validateJudgeCalibration(parsed.scores, input);
    const diagram = parsed.diagram === undefined ? undefined : normalizeEvaluationDiagram(parsed.diagram);
    if ((parsed.diagramStatus === "generated") !== Boolean(diagram)) throw new Error("Inconsistent diagram");
    return { ...parsed, diagram };
  } catch (error) {
    throwIfAborted(signal);
    throw error instanceof EvaluationError ? error : new EvaluationError("JUDGE_FAILED");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

/** Evaluate supplied evidence; no database, filesystem, queue or implicit network. */
export async function evaluate(input: EvaluationInput, options: EvaluationOptions = {}): Promise<EvaluationResult> {
  if (!options || typeof options !== "object" || Array.isArray(options) ||
      Object.keys(options).some((key) => !["judge", "aiPolicy", "evaluatedAt", "signal", "judgeTimeoutMs", "onStage"].includes(key)) ||
      (options.signal !== undefined && !(options.signal instanceof AbortSignal))) {
    throw new EvaluationError("INVALID_OPTIONS");
  }
  throwIfAborted(options.signal);
  const value = parseEvaluationInput(input);
  const aiPolicy = options.aiPolicy ?? "optional";
  const judgeTimeoutMs = options.judgeTimeoutMs ?? 65_000;
  const at = options.evaluatedAt ?? new Date().toISOString();
  if (!["optional", "required", "disabled"].includes(aiPolicy) ||
      !Number.isInteger(judgeTimeoutMs) || judgeTimeoutMs < 1 || judgeTimeoutMs > 300_000 ||
      !timestampSchema.safeParse(at).success ||
      (options.judge !== undefined && typeof options.judge !== "function") ||
      (options.onStage !== undefined && typeof options.onStage !== "function")) {
    throw new EvaluationError("INVALID_OPTIONS");
  }
  if (aiPolicy === "required" && !options.judge) throw new EvaluationError("JUDGE_UNAVAILABLE");
  const stage = async (name: EvaluationStage) => {
    throwIfAborted(options.signal);
    await options.onStage?.(name);
    throwIfAborted(options.signal);
  };
  const readme = value.readme;
  const documents = [
    { path: "README.md", content: readme, kind: "documentation" as const },
    ...value.files.map((file) => ({ ...file, kind: file.kind ?? inferDocumentKind(file.path) })),
  ];
  const filePaths = documents.map((document) => document.path);
  const documentation = scoreDocumentation(readme, value.description, filePaths);
  await stage("security");
  const security = scanDocuments(documents);
  const popStats = value.popularity;
  const popularityScore = scorePopularity(popStats);
  const lastCommit = value.lastCommitAt ? new Date(value.lastCommitAt) : null;
  const activityScore = scoreActivity(lastCommit, value.openIssues, popStats.stars, new Date(at));
  const deterministicQuality = deterministicQualityScore(documentation, filePaths, value.hasLicense, value.hasRepository, value.type);
  await stage("quality");
  let aiResult: JudgeResult | null = null;
  const diagnostics: EvaluationResult["diagnostics"] = {
    aiStatus: aiPolicy === "disabled" ? "disabled" : "unconfigured",
  };
  if (options.judge && aiPolicy !== "disabled") {
    try {
      aiResult = await invokeJudge(options.judge, {
        name: value.name, type: value.type, description: value.description ?? "", readme,
        deterministicEvidence: documentation.checks.map((check) => `${check.passed ? "通过" : "缺失"}: ${check.label}`),
      }, options.signal, judgeTimeoutMs);
      diagnostics.aiStatus = "completed";
    } catch (error) {
      const failure = error instanceof EvaluationError ? error : new EvaluationError("JUDGE_FAILED");
      if (failure.code === "ABORTED" || aiPolicy === "required") throw failure;
      diagnostics.aiStatus = "failed";
      diagnostics.aiErrorCode = failure.code;
    }
  }
  const qualityScore = combineQualityScore(deterministicQuality, aiResult?.score ?? null);
  const overall = calculateOverallScore({ documentation: documentation.score, security: security.score,
    popularity: popularityScore, activity: activityScore, quality: qualityScore, riskLevel: security.riskLevel });
  const confidenceBreakdown = calculateConfidenceBreakdown({
    readmeEvidenceCharacters: calculateEffectiveReadmeEvidenceCharacters(readme),
    evidenceSourceCount: countIndependentEvidenceSources(documents),
    aiJudgeUsed: Boolean(aiResult), hasRepoMetadata: value.hasRepositoryMetadata, hasActivity: Boolean(lastCommit),
  });
  const summary = buildSummary(overall, security.riskLevel, confidenceBreakdown.score);
  const concerns = [
    ...security.findings.slice(0, 3).map((finding) => finding.message),
    ...(aiResult?.calibrationNotes ?? []),
    ...documentation.improvements.slice(0, 3).map((item) => `缺少${item}`),
    ...(aiResult?.concerns ?? []),
  ].filter((v, i, values) => values.indexOf(v) === i).slice(0, 6);
  const strengths = [
    ...documentation.strengths,
    ...(security.riskLevel === "low" ? ["未发现已知高风险模式"] : []),
    ...(aiResult?.strengths ?? []),
  ].filter((v, i, values) => values.indexOf(v) === i).slice(0, 6);
  await stage("report");
  const report: CompletedEvaluationReport = {
    version: EVALUATOR_VERSION, summary, diagram: aiResult?.diagram, documentation,
    security: { score: security.score, details: security.details, findings: security.findings,
      riskLevel: security.riskLevel, scannedFiles: security.scannedFiles, scannedCharacters: security.scannedCharacters },
    popularity: { score: popularityScore,
      details: `${popStats.stars.toLocaleString()} Stars · ${popStats.downloadsWeekly.toLocaleString()} 周下载 · 30 天增长 ${popStats.starsGrowth30d >= 0 ? "+" : ""}${popStats.starsGrowth30d}`,
      stats: popStats },
    activity: { score: activityScore,
      details: lastCommit ? `最近提交于 ${lastCommit.toISOString().slice(0, 10)}` : "未获得有效提交记录",
      lastCommitAt: lastCommit?.toISOString() ?? null },
    quality: { score: qualityScore,
      details: aiResult?.details ?? `确定性工程质量 ${deterministicQuality}/100 · AI 复核暂不可用`,
      llmComment: aiResult?.comment, deterministicScore: deterministicQuality, aiScore: aiResult?.score ?? null,
      subScores: aiResult?.scores, evidence: aiResult?.evidence },
    recommendation: { strengths, concerns, bestFor: aiResult?.bestFor ?? [],
      avoidFor: aiResult?.avoidFor ?? (security.riskLevel === "critical" ? ["生产环境与敏感数据场景"] : []),
      nextActions: [
        ...security.findings.slice(0, 3).map((finding) => finding.remediation).filter((item): item is string => Boolean(item)),
        ...documentation.improvements.slice(0, 3).map((item) => `补充${item}`),
      ].filter((v, i, values) => values.indexOf(v) === i).slice(0, 6) },
    methodology: {
      evaluatorVersion: EVALUATOR_VERSION, evaluatedAt: new Date(at).toISOString(),
      sources: value.sources.map(redactKnownSecrets), scannedFiles: filePaths, scannedCharacters: security.scannedCharacters,
      aiJudgeUsed: Boolean(aiResult), diagramStatus: aiResult?.diagramStatus ?? "judge-unavailable",
      diagramRejectionReason: aiResult?.diagramRejectionReason, diagramRecoveryAttempted: aiResult?.diagramRecoveryAttempted,
      diagramRecoveryStatus: aiResult?.diagramRecoveryStatus, aiJudgeModel: aiResult?.model,
      rubricVersion: aiResult?.rubricVersion, aiJudgeCalibration: aiResult?.calibrationNotes,
      evaluatedSkillType: value.type, skillClassifierVersion: value.classifierVersion,
      weights: { ...WEIGHTS }, confidenceFactors: confidenceBreakdown.factors,
      limitations: ["静态评测不会安装或执行项目代码", "安全扫描基于高信号文件与已知模式，不能替代人工审计", "流行度只反映采用程度，不代表安全或工程质量"],
      caseStudy: value.caseStudy,
    },
    overall,
  };
  return { report, diagnostics };
}
