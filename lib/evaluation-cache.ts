import { EVALUATOR_VERSION } from "./evaluation-scoring";

export const FRESH_EVALUATION_MAX_AGE_MS = 24 * 60 * 60_000;

type CachedEvaluation = {
  evaluatedAt: Date | null;
  report: unknown;
};

export function isCurrentEvaluationFresh(
  evaluation: CachedEvaluation | null | undefined,
  now = new Date(),
): boolean {
  if (!evaluation?.evaluatedAt || !evaluation.report || typeof evaluation.report !== "object") return false;
  const version = (evaluation.report as { version?: unknown }).version;
  if (version !== EVALUATOR_VERSION) return false;

  const age = now.getTime() - evaluation.evaluatedAt.getTime();
  return age >= 0 && age < FRESH_EVALUATION_MAX_AGE_MS;
}
