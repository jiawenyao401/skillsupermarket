import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_COVERAGE_BATCH_SIZE,
  evaluationQueuePriority,
  MAX_COVERAGE_BATCH_SIZE,
  normalizeCoverageBatchSize,
  SCHEDULED_COVERAGE_TRIGGER,
} from "../lib/evaluation-queue-policy";

test("coverage batch is bounded and can be disabled without a deployment", () => {
  assert.equal(normalizeCoverageBatchSize(undefined), DEFAULT_COVERAGE_BATCH_SIZE);
  assert.equal(normalizeCoverageBatchSize(""), DEFAULT_COVERAGE_BATCH_SIZE);
  assert.equal(normalizeCoverageBatchSize("invalid"), DEFAULT_COVERAGE_BATCH_SIZE);
  assert.equal(normalizeCoverageBatchSize("0"), 0);
  assert.equal(normalizeCoverageBatchSize("2.9"), 2);
  assert.equal(normalizeCoverageBatchSize("999"), MAX_COVERAGE_BATCH_SIZE);
});

test("queue policy keeps user work ahead of bounded coverage work", () => {
  const jobs = [
    { id: "coverage", userId: null, triggeredBy: SCHEDULED_COVERAGE_TRIGGER },
    { id: "ops", userId: null, triggeredBy: "queue" },
    { id: "case", userId: null, triggeredBy: "case-study" },
    { id: "user", userId: "user-id", triggeredBy: "authenticated-user" },
    { id: "user-fallback", userId: "user-id", triggeredBy: "legacy" },
  ].sort((left, right) => evaluationQueuePriority(left) - evaluationQueuePriority(right));

  assert.deepEqual(jobs.map((job) => job.id), ["user", "user-fallback", "case", "ops", "coverage"]);
});
