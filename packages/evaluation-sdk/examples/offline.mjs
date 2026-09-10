import { readFile } from "node:fs/promises";
import { evaluate, parseEvaluationInput, EvaluationError } from "@skill-supermarket/evaluation-sdk";

try {
  if (process.argv.length !== 3) throw new Error("usage");
  const input = parseEvaluationInput(JSON.parse(await readFile(process.argv[2], "utf8")));
  const result = await evaluate(input, { aiPolicy: "disabled" });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof EvaluationError ? error.code : "Cannot read input; usage: node offline.mjs input.json");
  process.exitCode = 1;
}
