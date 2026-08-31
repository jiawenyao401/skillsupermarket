export const SCHEDULED_COVERAGE_TRIGGER = "scheduled-coverage";
export const DEFAULT_COVERAGE_BATCH_SIZE = 5;
export const MAX_COVERAGE_BATCH_SIZE = 5;
export const EVALUATION_QUEUE_PRIORITY = {
  authenticatedUser: 0,
  attributedUser: 1,
  caseStudy: 2,
  operations: 3,
  scheduledCoverage: 4,
} as const;

export function normalizeCoverageBatchSize(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return DEFAULT_COVERAGE_BATCH_SIZE;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_COVERAGE_BATCH_SIZE;
  return Math.max(0, Math.min(Math.trunc(parsed), MAX_COVERAGE_BATCH_SIZE));
}

export function evaluationQueuePriority(input: {
  userId: string | null;
  triggeredBy: string | null;
}): number {
  if (input.userId && input.triggeredBy === "authenticated-user") return EVALUATION_QUEUE_PRIORITY.authenticatedUser;
  if (input.userId) return EVALUATION_QUEUE_PRIORITY.attributedUser;
  if (input.triggeredBy === "case-study") return EVALUATION_QUEUE_PRIORITY.caseStudy;
  if (input.triggeredBy === SCHEDULED_COVERAGE_TRIGGER) return EVALUATION_QUEUE_PRIORITY.scheduledCoverage;
  return EVALUATION_QUEUE_PRIORITY.operations;
}
