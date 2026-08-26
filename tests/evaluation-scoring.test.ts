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

test("documentation scoring rejects keyword-packed checklist gaming without executable evidence", () => {
  const readme = `# Keyword-rich Agent

This agent claims to solve every automation problem for every team with reliable reusable production quality and complete documentation.

## Install example parameters outputs security limitations errors

Installation setup example input parameters tools output response result security permissions limitations errors troubleshooting FAQ license. These words are repeated to satisfy superficial keyword checks, but no usable installation command, parameter contract, permission boundary, failure behavior, or real example is provided.

\`\`\`text
installation example parameters outputs security limitations errors
\`\`\`

## Usage

Use the agent for automation. This section intentionally avoids a concrete command, input schema, output schema, or verifiable result while padding the README beyond a simple length threshold.

## License

License information is mentioned without supplying an actual license file or recognized license identifier.
`;
  const result = scoreDocumentation(
    readme,
    "A deliberately keyword-stuffed README with no reproducible adoption or safety evidence.",
    ["README.md"],
  );

  assert.equal(result.score, 30);
  assert.match(result.details, /反关键词堆砌保护/);
  assert.ok(result.checks
    .filter((check) => ["install", "example", "inputs", "outputs", "limitations", "errors"].includes(check.id))
    .every((check) => !check.passed));
});

test("documentation anti-gaming guard preserves actionable compact guides", () => {
  const readme = `# Compact Agent Guide

This production agent automates repository diagnostics for engineering teams and returns structured, read-only results for failed jobs.

## Install, parameters, outputs, security, errors

The quick start uses a scoped token. The inspect tool accepts a required job parameter, returns a status object, is read-only, and reports authentication errors without exposing credentials.

\`\`\`bash
npx @example/compact-agent --token-env COMPACT_AGENT_TOKEN
\`\`\`

## Usage example

Call inspect with a job identifier and check the returned status before retrying a failed request. This example documents the main input and output contract.

## Limitations and troubleshooting

The agent never writes repository state. Confirm the token scope and retry after rate limits. Private networks require an operator-managed proxy.

## License

Apache-2.0.
`;
  const result = scoreDocumentation(
    readme,
    "A compact, read-only repository diagnostics agent with an executable setup path.",
    ["README.md", "LICENSE"],
  );

  assert.doesNotMatch(result.details, /反关键词堆砌保护/);
  assert.ok(result.score >= 80);
});
