import { readFile } from "node:fs/promises";
import { evaluate, createLLMJudge, parseEvaluationInput, EvaluationError } from "@skill-supermarket/evaluation-sdk";

try {
  if (process.argv.length !== 3) throw new Error("usage");
  const input = parseEvaluationInput(JSON.parse(await readFile(process.argv[2], "utf8")));
  const judge = createLLMJudge({
    provider: "deepseek",
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  });
  const result = await evaluate(input, { judge, aiPolicy: "required", signal: AbortSignal.timeout(65_000) });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof EvaluationError ? error.code : "Cannot read input; usage: node with-ai.mjs input.json");
  process.exitCode = 1;
}
