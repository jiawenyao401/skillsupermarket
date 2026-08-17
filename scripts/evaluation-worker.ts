// Production evaluation worker. PM2 keeps this process alive and the queue
// claim in lib/evaluator guarantees that multiple workers cannot run one job.
import { processEvaluationQueue } from "../lib/evaluator";

const pollIntervalMs = Math.max(1_000, Math.min(Number(process.env.EVALUATION_POLL_MS) || 5_000, 60_000));
const batchSize = Math.max(1, Math.min(Number(process.env.EVALUATION_BATCH_SIZE) || 3, 10));
let stopping = false;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
    console.log(`[evaluation-worker] received ${signal}; finishing the current batch`);
  });
}

async function main() {
  console.log(`[evaluation-worker] started (batch=${batchSize}, poll=${pollIntervalMs}ms)`);
  let consecutiveFailures = 0;

  while (!stopping) {
    try {
      const processed = await processEvaluationQueue(batchSize);
      consecutiveFailures = 0;
      if (processed > 0) console.log(`[evaluation-worker] completed ${processed} job(s)`);
      if (!stopping) await wait(processed > 0 ? 250 : pollIntervalMs);
    } catch (error) {
      consecutiveFailures += 1;
      const backoff = Math.min(pollIntervalMs * 2 ** Math.min(consecutiveFailures, 5), 60_000);
      console.error(`[evaluation-worker] queue error; retrying in ${backoff}ms`, error);
      if (!stopping) await wait(backoff);
    }
  }

  console.log("[evaluation-worker] stopped cleanly");
}

main().catch((error) => {
  console.error("[evaluation-worker] fatal error", error);
  process.exitCode = 1;
});
