import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluate } from "../packages/evaluation-sdk/src/evaluate.ts";
import { EVALUATOR_VERSION } from "../packages/evaluation-sdk/src/evaluation-scoring.ts";
import type { EvaluationInput } from "../packages/evaluation-sdk/src/input.ts";
import type { JudgeResult } from "../packages/evaluation-sdk/src/judge.ts";

interface FixtureFile {
  baselineCommit: string;
  evaluatorVersion: string;
  evaluatedAt: string;
  medianMs?: number;
  p95Ms?: number;
  fixtures: Array<{
    id: string;
    input: EvaluationInput;
    ai: JudgeResult | null;
    expected: unknown;
  }>;
}

async function main(): Promise<void> {
  const [sourceArg, destinationArg, baselineCommit] = process.argv.slice(2);
  if (!sourceArg || !destinationArg || !/^[0-9a-f]{7,40}$/i.test(baselineCommit ?? "")) {
    throw new Error("Usage: regenerate-sdk-parity <source.json> <destination.json> <baseline-commit>");
  }

  const source = JSON.parse(await readFile(resolve(sourceArg), "utf8")) as FixtureFile;
  const fixtures = [];
  for (const fixture of source.fixtures) {
    const result = await evaluate(fixture.input, {
      evaluatedAt: source.evaluatedAt,
      judge: fixture.ai ? async () => fixture.ai as JudgeResult : undefined,
    });
    fixtures.push({ ...fixture, expected: result.report });
  }

  await writeFile(resolve(destinationArg), `${JSON.stringify({
    baselineCommit,
    evaluatorVersion: EVALUATOR_VERSION,
    evaluatedAt: source.evaluatedAt,
    fixtures,
  }, null, 2)}\n`, "utf8");
}

void main();
