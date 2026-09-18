import "dotenv/config";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createLLMJudge, type JudgeInput } from "../packages/evaluation-sdk/src/index.ts";

const skill = `---
name: csv-summary
description: Summarize CSV columns when the user asks for totals or data quality checks.
---

# CSV summary workflow

1. Read the supplied CSV without modifying it.
2. Validate headers and numeric columns before calculation.
3. Return a Markdown table with totals and rejected rows.

If the file is missing or a numeric value is invalid, report the exact input problem and ask for a corrected file.
`;
const base: JudgeInput = {
  name: "csv-summary",
  type: "claude-skill",
  description: "Summarize CSV data safely.",
  readme: "# CSV Summary\n\nA compact Agent Skill.",
  deterministicEvidence: [
    "缺失: 安装或接入步骤",
    "缺失: 可执行示例",
    "通过: 问题与用途描述",
    "缺失: 输入、参数或工具",
    "缺失: 输出与返回值",
    "通过: 限制、安全或权限边界",
    "通过: Agent Skills 格式校验：1/1 个通过",
  ],
};

async function main(): Promise<void> {
  assert.equal(process.argv.includes("--live"), true, "Pass --live to authorize real model calls");
  const apiKey = process.env.DEEPSEEK_API_KEY;
  assert.ok(apiKey, "DEEPSEEK_API_KEY is required");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-flash";
  let requests = 0;
  const transport: typeof fetch = async (input, init) => {
    requests += 1;
    return fetch(input, init);
  };
  const judge = createLLMJudge({ provider: "deepseek", apiKey, model, timeoutMs: 60_000, fetch: transport });
  const cases: Array<{ id: string; input: JudgeInput }> = [
    { id: "readme-only-baseline", input: base },
    { id: "skill-body-candidate", input: { ...base, skill: {
      path: "csv-summary/SKILL.md", content: skill, valid: true, issues: [], warnings: [],
    } } },
  ];
  const repeats = Number(process.env.BENCHMARK_REPEAT ?? "2");
  assert.ok(Number.isInteger(repeats) && repeats >= 1 && repeats <= 3);
  const results = [];
  for (const fixture of cases) {
    const runs = [];
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const beforeRequests = requests;
      const startedAt = performance.now();
      const result = await judge(fixture.input, { signal: AbortSignal.timeout(65_000) });
      runs.push({
        score: result.score,
        diagramStatus: result.diagramStatus,
        diagramType: result.diagram?.type ?? null,
        milliseconds: Math.round(performance.now() - startedAt),
        modelRequests: requests - beforeRequests,
      });
    }
    results.push({
      id: fixture.id,
      evidenceCharacters: fixture.input.readme.length + (fixture.input.skill?.content.length ?? 0),
      runs,
      scoreDrift: Math.max(...runs.map((run) => run.score)) - Math.min(...runs.map((run) => run.score)),
    });
  }
  console.log(JSON.stringify({ benchmark: "agent-skill-body-v1", model, repeats, results }, null, 2));
}

void main();
