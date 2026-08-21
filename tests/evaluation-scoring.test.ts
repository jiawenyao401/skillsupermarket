import assert from "node:assert/strict";
import test from "node:test";
import {
  SCORING_GOLDEN_CASES,
  SCORING_GOLDEN_SET_VERSION,
} from "../data/evaluation-golden-cases";
import {
  buildSummary,
  calculateConfidence,
  calculateOverallScore,
  combineQualityScore,
  deterministicQualityScore,
  EVALUATOR_VERSION,
  scoreActivity,
  scoreDocumentation,
  scorePopularity,
} from "../lib/evaluation-scoring";

const FIXED_NOW = new Date("2026-01-15T00:00:00.000Z");

test(`evaluation scoring golden set ${SCORING_GOLDEN_SET_VERSION} matches evaluator ${EVALUATOR_VERSION}`, () => {
  assert.ok(SCORING_GOLDEN_CASES.length >= 3, "golden set must cover mature, sparse, and blocked cases");

  for (const fixture of SCORING_GOLDEN_CASES) {
    const documentation = scoreDocumentation(fixture.readme, fixture.description, fixture.filePaths);
    const deterministicQuality = deterministicQualityScore(
      documentation,
      fixture.filePaths,
      fixture.hasLicense,
      fixture.hasRepo,
      fixture.type,
    );
    const popularity = scorePopularity(fixture.popularity);
    const lastCommit = fixture.activity.daysSinceLastCommit === null
      ? null
      : new Date(FIXED_NOW.getTime() - fixture.activity.daysSinceLastCommit * 86_400_000);
    const activity = scoreActivity(
      lastCommit,
      fixture.activity.openIssues,
      fixture.activity.stars,
      FIXED_NOW,
    );
    const quality = combineQualityScore(deterministicQuality, fixture.aiScore);
    const confidence = calculateConfidence({
      readmeLength: fixture.readme.length,
      fileCount: fixture.filePaths.length,
      aiJudgeUsed: fixture.aiScore !== null,
      hasRepoMetadata: fixture.hasRepo,
      hasActivity: lastCommit !== null,
    });
    const overall = calculateOverallScore({
      documentation: documentation.score,
      security: fixture.securityScore,
      popularity,
      activity,
      quality,
      riskLevel: fixture.riskLevel,
    });
    const summary = buildSummary(overall, fixture.riskLevel, confidence);

    assert.deepEqual(
      {
        documentation: documentation.score,
        deterministicQuality,
        quality,
        popularity,
        activity,
        confidence,
        overall,
        grade: summary.grade,
        verdict: summary.verdict,
      },
      fixture.expected,
      `${fixture.id} drifted; review the scoring change and deliberately version the golden set if accepted`,
    );
  }
});

test("risk caps remain policy invariants across raw score changes", () => {
  const base = {
    documentation: 100,
    security: 100,
    popularity: 100,
    activity: 100,
    quality: 100,
  };
  assert.equal(calculateOverallScore({ ...base, riskLevel: "high" }), 59);
  assert.equal(calculateOverallScore({ ...base, riskLevel: "critical" }), 39);
});
