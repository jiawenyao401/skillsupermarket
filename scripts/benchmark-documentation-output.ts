import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import * as candidate from "../lib/evaluation-scoring";
import { DOCUMENTATION_OUTPUT_CASES as cases, DOCUMENTATION_OUTPUT_SET_VERSION } from "../data/documentation-output-cases";

function measure(scorer: typeof candidate) {
  const outcomes = cases.map((fixture) => {
    const outputs = Array.from({ length: 10 }, () => scorer.scoreDocumentation(fixture.readme, fixture.description, fixture.filePaths));
    const result = outputs[0];
    return { id: fixture.id, expected: fixture.expectedScore, actual: result.score,
      passed: result.score === fixture.expectedScore && ["install", "example"].every((id) =>
        result.checks.find((c) => c.id === id)?.passed === fixture.actionable),
      drift: outputs.some((r) => JSON.stringify(r) !== JSON.stringify(result)) };
  });
  const durations: number[] = [];
  for (let round = 0; round < 50; round++) {
    const start = performance.now();
    for (const fixture of cases) scorer.scoreDocumentation(fixture.readme, fixture.description, fixture.filePaths);
    durations.push((performance.now() - start) / cases.length);
  }
  durations.sort((a, b) => a - b);
  return { version: scorer.EVALUATOR_VERSION, passed: outcomes.filter((r) => r.passed).length,
    total: outcomes.length, drift: outcomes.filter((r) => r.drift).length,
    medianMs: +durations[25].toFixed(3), p95Ms: +durations[47].toFixed(3), extraModelCalls: 0, outcomes };
}

async function main() {
  const path = process.env.SCORING_BENCHMARK_BASELINE;
  const baseline = path ? await import(pathToFileURL(path).href) as typeof candidate : null;
  const result = measure(candidate);
  console.log(JSON.stringify({ benchmark: DOCUMENTATION_OUTPUT_SET_VERSION,
    fixtureSha256: createHash("sha256").update(JSON.stringify(cases)).digest("hex"),
    baseline: baseline ? measure(baseline) : undefined, candidate: result }, null, 2));
  if (process.argv.includes("--check") && (result.passed !== result.total || result.drift)) process.exitCode = 1;
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
