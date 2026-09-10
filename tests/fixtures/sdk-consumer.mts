import { evaluate, createLLMJudge, type EvaluationInput, type EvaluationResult } from "@skill-supermarket/evaluation-sdk";
import { scoreDocumentation } from "@skill-supermarket/evaluation-sdk/scoring";
import { scanDocuments } from "@skill-supermarket/evaluation-sdk/scanner";
import type { Judge } from "@skill-supermarket/evaluation-sdk/judge";

const input: EvaluationInput = { name: "Typed consumer", type: "claude-skill", readme: "" };
const result: EvaluationResult = await evaluate(input);
result.report.summary.confidence.toFixed();
const judge: Judge = createLLMJudge({ provider: "openai", apiKey: "test", model: "fixture" });
void judge;
scoreDocumentation("", null, []);
scanDocuments([{ path: "SKILL.md", content: "", kind: "instruction" }]);
// @ts-expect-error Unsupported types must fail at compile time.
const invalid: EvaluationInput = { name: "Invalid", type: "arbitrary", readme: "" };
void invalid;
