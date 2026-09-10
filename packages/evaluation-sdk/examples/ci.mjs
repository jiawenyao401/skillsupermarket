import { readFile } from "node:fs/promises";
import { evaluate, parseEvaluationInput, EvaluationError } from "@skill-supermarket/evaluation-sdk";

// Example policy, not a universal security certification. Choose and version
// thresholds in your application; never override the engine's scoring weights.
try {
  if (process.argv.length !== 3) throw new Error("usage");
  const input = parseEvaluationInput(JSON.parse(await readFile(process.argv[2], "utf8")));
  const { report } = await evaluate(input, { aiPolicy: "disabled" });
  const requiresReview = ["critical", "high"].includes(report.summary.riskLevel) || report.summary.confidence < 40;
  console.log(JSON.stringify({ requiresReview, report }, null, 2));
  process.exitCode = requiresReview ? 2 : 0;
} catch (error) {
  console.error(error instanceof EvaluationError ? error.code : "Cannot read input; usage: node ci.mjs input.json");
  process.exitCode = 1;
}
