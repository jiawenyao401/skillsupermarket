import assert from "node:assert/strict";
import test from "node:test";
import {
  SCORING_GOLDEN_CASES,
  SCORING_GOLDEN_SET_VERSION,
} from "../data/evaluation-golden-cases";
import {
  buildSummary,
  calculateConfidence,
  calculateConfidenceBreakdown,
  calculateEffectiveReadmeEvidenceCharacters,
  calculateOverallScore,
  combineQualityScore,
  countIndependentEvidenceSources,
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
    const evidenceDocuments = fixture.filePaths.map((path) => ({
      path,
      content: path.toLowerCase().endsWith("readme.md") ? fixture.readme : "x".repeat(80),
    }));
    const confidence = calculateConfidence({
      readmeEvidenceCharacters: calculateEffectiveReadmeEvidenceCharacters(fixture.readme),
      evidenceSourceCount: countIndependentEvidenceSources(evidenceDocuments),
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

test("confidence rewards independent evidence families instead of duplicate files", () => {
  const documents = [
    { path: "README.md", content: "A".repeat(500) },
    { path: "packages/a/package.json", content: "A".repeat(80) },
    { path: "packages/b/package.json", content: "A".repeat(80) },
    { path: "packages/c/package.json", content: "A".repeat(80) },
    { path: "SECURITY.md", content: "short" },
  ];
  assert.equal(countIndependentEvidenceSources(documents), 2);

  const base = {
    readmeEvidenceCharacters: 500,
    aiJudgeUsed: false,
    hasRepoMetadata: true,
    hasActivity: true,
  };
  const oneManifest = calculateConfidence({ ...base, evidenceSourceCount: 2 });
  const manyDuplicateManifests = calculateConfidence({
    ...base,
    evidenceSourceCount: countIndependentEvidenceSources(documents),
  });
  assert.equal(oneManifest, 49);
  assert.equal(manyDuplicateManifests, oneManifest);

  assert.equal(countIndependentEvidenceSources([
    documents[0],
    { path: "packages/a/package.json", content: "A".repeat(80) },
    { path: "packages/b/package.json", content: "B".repeat(80) },
    { path: "packages/c/package.json", content: "C".repeat(80) },
  ]), 3, "manifest evidence receives bounded credit even when contents differ");
});

test("confidence ignores repeated README filler while preserving unique evidence", () => {
  const repeatedLine = "This repeated marketing sentence claims production quality without adding new evidence.";
  const readme = `# Filler\n\n${Array.from({ length: 200 }, () => repeatedLine).join("\n")}`;
  const effectiveCharacters = calculateEffectiveReadmeEvidenceCharacters(readme);
  assert.ok(readme.length > 10_000);
  assert.ok(effectiveCharacters < 200);

  const confidence = calculateConfidence({
    readmeEvidenceCharacters: effectiveCharacters,
    evidenceSourceCount: 1,
    aiJudgeUsed: false,
    hasRepoMetadata: true,
    hasActivity: true,
  });
  assert.equal(confidence, 44);
});

test("confidence breakdown explains the exact score without changing calibration", () => {
  const input = {
    readmeEvidenceCharacters: 3_200,
    evidenceSourceCount: 3,
    aiJudgeUsed: false,
    hasRepoMetadata: true,
    hasActivity: true,
  };
  const breakdown = calculateConfidenceBreakdown(input);

  assert.equal(breakdown.score, calculateConfidence(input));
  assert.equal(
    breakdown.factors.reduce((sum, factor) => sum + factor.contribution, 0),
    breakdown.score,
  );
  assert.deepEqual(breakdown.factors.map((factor) => factor.id), [
    "evaluation-complete",
    "readme-evidence",
    "independent-sources",
    "repository-metadata",
    "activity",
    "ai-review",
  ]);
  assert.deepEqual(
    breakdown.factors.find((factor) => factor.id === "ai-review"),
    {
      id: "ai-review",
      label: "AI 复核",
      status: "missing",
      contribution: 0,
      maxContribution: 15,
      detail: "未启用 AI 复核，本项不加分",
    },
  );
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
