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

test("judge calibration rejects inflated reusability when adoption evidence is missing", () => {
  assert.throws(() => validateJudgeCalibration(
    { utility: 12, clarity: 12, reusability: 16, design: 11, documentation: 11 },
    {
      name: "Hard to adopt skill",
      type: "mcp-server",
      description: "A plausible integration with incomplete adoption instructions.",
      readme: "A".repeat(800),
      deterministicEvidence: [
        "缺失: 安装或接入步骤",
        "缺失: 可执行示例",
        "缺失: 输入、参数或工具说明",
        "通过: 限制、权限或边界",
      ],
    },
  ), /复用性评分/);
});

test("judge calibration rejects inflated design when boundaries and failures are missing", () => {
  assert.throws(() => validateJudgeCalibration(
    { utility: 13, clarity: 12, reusability: 12, design: 16, documentation: 12 },
    {
      name: "Unsafe defaults skill",
      type: "agent-pack",
      description: "A documented agent pack without observable safety or failure handling.",
      readme: "B".repeat(800),
      deterministicEvidence: [
        "通过: 安装或接入步骤",
        "通过: 可执行示例",
        "缺失: 限制、权限或边界",
        "缺失: 错误处理或排障",
      ],
    },
  ), /设计评分/);
});

test("judge calibration accepts differentiated scores supported by complete evidence", () => {
  assert.doesNotThrow(() => validateJudgeCalibration(
    { utility: 16, clarity: 15, reusability: 14, design: 13, documentation: 15 },
    {
      name: "Evidence-backed skill",
      type: "claude-skill",
      description: "A complete skill with observable adoption, safety, and failure handling evidence.",
      readme: "Complete documentation. ".repeat(40),
      deterministicEvidence: [
        "通过: 安装或接入步骤",
        "通过: 可执行示例",
        "通过: 输入、参数或工具说明",
        "通过: 限制、权限或边界",
        "通过: 错误处理或排障",
      ],
    },
  ));
});

test("judge configuration accepts only supported provider keys", () => {
  assert.equal(hasJudgeConfiguration({ DEEPSEEK_API_KEY: "configured" }), true);
  assert.equal(hasJudgeConfiguration({ OPENAI_API_KEY: "configured" }), true);
  assert.equal(hasJudgeConfiguration({ ANTHROPIC_API_KEY: "configured" }), true);
  assert.equal(hasJudgeConfiguration({ AI_JUDGE_KEY: "unsupported-name" }), false);
  assert.equal(hasJudgeConfiguration({}), false);
});
