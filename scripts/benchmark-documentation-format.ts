import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import * as candidate from "../lib/evaluation-scoring";
import { DOCUMENTATION_FORMAT_CASES, DOCUMENTATION_FORMAT_SET_VERSION } from "../data/documentation-format-cases";

function measure(scorer: typeof candidate) {
  const outcomes = DOCUMENTATION_FORMAT_CASES.map((fixture) => {
    const outputs = Array.from({ length: 10 }, () => scorer.scoreDocumentation(fixture.readme, fixture.description, fixture.filePaths));
    return { id: fixture.id, expected: fixture.expectedScore, actual: outputs[0].score,
      passed: outputs[0].score === fixture.expectedScore,
      drift: outputs.some((output) => JSON.stringify(output) !== JSON.stringify(outputs[0])) };
  });
  const durations: number[] = [];
  for (let round = 0; round < 50; round++) {
    const start = performance.now();
    for (const fixture of DOCUMENTATION_FORMAT_CASES) scorer.scoreDocumentation(fixture.readme, fixture.description, fixture.filePaths);
    durations.push((performance.now() - start) / DOCUMENTATION_FORMAT_CASES.length);
  }
  durations.sort((a, b) => a - b);
  return { version: scorer.EVALUATOR_VERSION, passed: outcomes.filter((r) => r.passed).length,
    total: outcomes.length, drift: outcomes.filter((r) => r.drift).length,
    medianMsPerReadme: +durations[25].toFixed(3), p95MsPerReadme: +durations[47].toFixed(3),
    extraModelCalls: 0, outcomes };
}

async function main() {
  // Optional immutable local baseline copied with git show; no network or LLM.
  const baselinePath = process.env.SCORING_BENCHMARK_BASELINE;
  const baseline = baselinePath ? await import(pathToFileURL(baselinePath).href) as typeof candidate : null;
  const result = measure(candidate);
  console.log(JSON.stringify({ benchmark: DOCUMENTATION_FORMAT_SET_VERSION,
    baseline: baseline ? measure(baseline) : undefined, candidate: result }, null, 2));
  if (process.argv.includes("--check") && (result.passed !== result.total || result.drift)) process.exitCode = 1;
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
