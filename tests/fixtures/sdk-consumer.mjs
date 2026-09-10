import assert from "node:assert/strict";
import { evaluate, createLLMJudge, EVALUATOR_VERSION } from "@skill-supermarket/evaluation-sdk";
import { scoreActivity } from "@skill-supermarket/evaluation-sdk/scoring";
import { scanText } from "@skill-supermarket/evaluation-sdk/scanner";
import { createLLMJudge as subpathJudge } from "@skill-supermarket/evaluation-sdk/judge";

assert.equal(createLLMJudge, subpathJudge);
assert.equal(typeof scoreActivity, "function");
assert.equal(scanText("# Example").riskLevel, "low");
globalThis.fetch = async () => { throw new Error("Offline mode unexpectedly fetched"); };
const result = await evaluate({ name: "Isolated consumer", type: "agent-pack", readme: "# Example" }, { aiPolicy: "disabled" });
assert.equal(result.report.version, EVALUATOR_VERSION);
assert.equal(result.report.methodology.aiJudgeUsed, false);
assert.ok(Number.isFinite(result.report.overall));
console.log("isolated ESM consumer passed");
