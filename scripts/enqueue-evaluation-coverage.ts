import "dotenv/config";
import { enqueueEvaluationCoverage } from "../lib/evaluation-coverage";

async function main() {
  const result = await enqueueEvaluationCoverage(process.env.EVALUATION_COVERAGE_BATCH);
  if (result.batchSize === 0) {
    console.log("[coverage] disabled by EVALUATION_COVERAGE_BATCH=0");
    return;
  }
  console.log(`[coverage] queued ${result.jobIds.length}/${result.batchSize} uncovered project(s)`);
}

main().catch((error) => {
  console.error("[coverage] enqueue failed", error);
  process.exitCode = 1;
});
