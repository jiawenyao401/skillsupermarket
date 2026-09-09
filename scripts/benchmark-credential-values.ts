import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { scanDocuments } from "../lib/scanner";
import { CREDENTIAL_VALUE_CASES as cases, CREDENTIAL_VALUE_SET_VERSION } from "../data/credential-value-cases";

function measure(scan: typeof scanDocuments) {
  const outcomes = cases.map((fixture) => {
    const results = Array.from({ length: 10 }, () => scan([fixture]));
    const count = results[0].findings.filter((f) => f.type === "hardcoded-credential").length;
    return { id: fixture.id, expected: fixture.expectedFindings, actual: count,
      passed: count === fixture.expectedFindings,
      drift: results.some((r) => JSON.stringify(r) !== JSON.stringify(results[0])) };
  });
  const times = Array.from({ length: 50 }, () => {
    const start = performance.now();
    for (const fixture of cases) scan([fixture]);
    return (performance.now() - start) / cases.length;
  }).sort((a, b) => a - b);
  return { passed: outcomes.filter((o) => o.passed).length, total: outcomes.length,
    drift: outcomes.filter((o) => o.drift).length, medianMs: +times[25].toFixed(3),
    p95Ms: +times[47].toFixed(3), extraModelCalls: 0, outcomes };
}

async function main() {
  const baselinePath = process.env.SCANNER_BENCHMARK_BASELINE;
  const baseline = baselinePath
    ? measure((await import(pathToFileURL(baselinePath).href) as { scanDocuments: typeof scanDocuments }).scanDocuments)
    : undefined;
  const candidate = measure(scanDocuments);
  console.log(JSON.stringify({ benchmark: CREDENTIAL_VALUE_SET_VERSION,
    fixtureSha256: createHash("sha256").update(JSON.stringify(cases)).digest("hex"), baseline, candidate }, null, 2));
  if (process.argv.includes("--check") && (candidate.passed !== candidate.total || candidate.drift)) process.exitCode = 1;
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
