import assert from "node:assert/strict";
import test from "node:test";
import {
  FRESH_EVALUATION_MAX_AGE_MS,
  isCurrentEvaluationFresh,
} from "../lib/evaluation-cache";
import { EVALUATOR_VERSION } from "../lib/evaluation-scoring";

const now = new Date("2026-09-01T12:00:00.000Z");

test("current evaluator reports remain cacheable for less than 24 hours", () => {
  assert.equal(isCurrentEvaluationFresh({
    evaluatedAt: new Date(now.getTime() - FRESH_EVALUATION_MAX_AGE_MS + 1),
    report: { version: EVALUATOR_VERSION },
  }, now), true);
});

test("stale evaluator versions never masquerade as a current cached report", () => {
  assert.equal(isCurrentEvaluationFresh({
    evaluatedAt: new Date(now.getTime() - 1_000),
    report: { version: "3.0.0" },
  }, now), false);
});

test("expired, future, missing, and malformed evaluations are not cacheable", () => {
  assert.equal(isCurrentEvaluationFresh({
    evaluatedAt: new Date(now.getTime() - FRESH_EVALUATION_MAX_AGE_MS),
    report: { version: EVALUATOR_VERSION },
  }, now), false);
  assert.equal(isCurrentEvaluationFresh({
    evaluatedAt: new Date(now.getTime() + 1),
    report: { version: EVALUATOR_VERSION },
  }, now), false);
  assert.equal(isCurrentEvaluationFresh({ evaluatedAt: null, report: { version: EVALUATOR_VERSION } }, now), false);
  assert.equal(isCurrentEvaluationFresh({ evaluatedAt: now, report: "not-an-object" }, now), false);
});
