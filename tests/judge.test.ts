import assert from "node:assert/strict";
import test from "node:test";
import { hasJudgeConfiguration, selectReadmeEvidence, validateJudgeCalibration } from "../lib/judge";

test("long README evidence selection keeps late safety and troubleshooting sections", () => {
  const readme = [
    "# Example\n\nA useful integration.",
    ...Array.from({ length: 30 }, (_, index) => `## Feature ${index}\n\n${"General capability. ".repeat(90)}`),
    "## Security and permissions\n\nNever expose secrets. Use least privilege.",
    "## Troubleshooting\n\nRetry 429 responses with exponential backoff.",
  ].join("\n\n");
  const selected = selectReadmeEvidence(readme);
  assert.ok(selected.length <= 30_000);
  assert.match(selected, /Security and permissions/);
  assert.match(selected, /Troubleshooting/);
});

test("judge calibration rejects inflated scores when most evidence is missing", () => {
  assert.throws(() => validateJudgeCalibration(
    { utility: 16, clarity: 15, reusability: 15, design: 14, documentation: 15 },
    {
      name: "Sparse skill",
      type: "claude-skill",
      description: "",
      readme: "short",
      deterministicEvidence: [
        "缺失: README",
        "缺失: 安装步骤",
        "缺失: 示例",
        "缺失: 限制说明",
      ],
    }
  ), /缺失证据不一致/);
});

test("judge configuration accepts only supported provider keys", () => {
  assert.equal(hasJudgeConfiguration({ DEEPSEEK_API_KEY: "configured" }), true);
  assert.equal(hasJudgeConfiguration({ OPENAI_API_KEY: "configured" }), true);
  assert.equal(hasJudgeConfiguration({ ANTHROPIC_API_KEY: "configured" }), true);
  assert.equal(hasJudgeConfiguration({ AI_JUDGE_KEY: "unsupported-name" }), false);
  assert.equal(hasJudgeConfiguration({}), false);
});
