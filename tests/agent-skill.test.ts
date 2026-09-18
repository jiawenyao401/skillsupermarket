import assert from "node:assert/strict";
import test from "node:test";
import { analyzeAgentSkills, evaluate, type EvaluationInput, type JudgeInput } from "../packages/evaluation-sdk/src/index";

const VALID_SKILL = `---
name: csv-summary
description: Summarize CSV columns when the user asks for totals or data quality checks.
license: Apache-2.0
compatibility: Requires read access to a local CSV file
metadata:
  author: example
  version: "1.0"
---

# CSV summary workflow

1. Read the supplied CSV path without modifying the source file.
2. Validate headers and numeric columns before calculating totals.
3. Return a Markdown table with column names, totals, and rejected rows.

If the file is missing or a numeric value is invalid, report the exact input problem and ask the user to correct it.
`;

const base: EvaluationInput = {
  name: "csv-summary",
  type: "claude-skill",
  readme: "# CSV Summary\n\nA compact Agent Skill.",
  hasRepository: true,
  hasLicense: true,
};

test("Agent Skills format parser accepts the official shape and rejects empty, unsafe, and mismatched documents", () => {
  const valid = analyzeAgentSkills([{ path: "csv-summary/SKILL.md", content: VALID_SKILL }]);
  assert.deepEqual(
    { detected: valid.detected, valid: valid.valid, invalid: valid.invalid, substantive: valid.substantive },
    { detected: 1, valid: 1, invalid: 0, substantive: 1 },
  );
  assert.equal(valid.selected?.name, "csv-summary");

  const invalid = analyzeAgentSkills([
    { path: "empty/SKILL.md", content: "" },
    { path: "wrong/SKILL.md", content: VALID_SKILL },
    { path: "alias/SKILL.md", content: "---\nname: alias\ndescription: &d Use for alias checks.\nmetadata: { copied: *d }\n---\n\nRun the check." },
    { path: "case/skill.md", content: "---\nname: case\ndescription: Use when checking case.\n---\n\nRun the check." },
  ]);
  assert.equal(invalid.detected, 4);
  assert.equal(invalid.valid, 0);
  assert.ok(invalid.inspections.some((item) => item.issues.includes("SKILL.md 父目录名必须与 name 一致")));
  assert.ok(invalid.inspections.some((item) => item.issues.includes("YAML frontmatter 无法安全、唯一地解析")));
  assert.ok(invalid.inspections.some((item) => item.issues.includes("文件名必须严格为 SKILL.md")));
});

test("quality bonus requires valid Skill content and distinguishes thin from substantive instructions", async () => {
  const none = await evaluate(base, { aiPolicy: "disabled", evaluatedAt: "2026-09-18T00:00:00.000Z" });
  const empty = await evaluate({ ...base, files: [{ path: "csv-summary/SKILL.md", content: "" }] }, {
    aiPolicy: "disabled", evaluatedAt: "2026-09-18T00:00:00.000Z",
  });
  const thin = await evaluate({ ...base, files: [{
    path: "csv-summary/SKILL.md",
    content: "---\nname: csv-summary\ndescription: Use when summarizing CSV data.\n---\n\nRead the CSV.",
  }] }, { aiPolicy: "disabled", evaluatedAt: "2026-09-18T00:00:00.000Z" });
  const substantive = await evaluate({ ...base, files: [{ path: "csv-summary/SKILL.md", content: VALID_SKILL }] }, {
    aiPolicy: "disabled", evaluatedAt: "2026-09-18T00:00:00.000Z",
  });

  assert.equal(empty.report.quality.deterministicScore, none.report.quality.deterministicScore);
  assert.equal((thin.report.quality.deterministicScore ?? 0) - (none.report.quality.deterministicScore ?? 0), 12);
  assert.equal((substantive.report.quality.deterministicScore ?? 0) - (none.report.quality.deterministicScore ?? 0), 28);
  assert.ok(substantive.report.documentation.score > none.report.documentation.score);
  assert.equal(empty.report.agentSkills?.invalid, 1);
  assert.ok(empty.report.quality.evidence?.some((item) => item.startsWith("未通过:")));
  assert.ok(!empty.report.recommendation?.strengths.some((item) => /Agent Skills 格式校验/.test(item)));
  assert.equal(substantive.report.agentSkills?.substantive, 1);
});

test("judge receives real Skill instructions while ordinary MCP servers remain valid without the optional extension", async () => {
  let received: JudgeInput | undefined;
  await evaluate({ ...base, files: [{ path: "csv-summary/SKILL.md", content: VALID_SKILL }] }, {
    evaluatedAt: "2026-09-18T00:00:00.000Z",
    judge: async (input) => {
      received = input;
      return {
        score: 45,
        details: "实用 11/20 · 清晰 10/20 · 复用 9/20 · 设计 8/20 · 文档 7/20",
        comment: "正文给出可执行流程，但采用文档仍较少。",
        scores: { utility: 11, clarity: 10, reusability: 9, design: 8, documentation: 7 },
        strengths: [], concerns: [], bestFor: [], avoidFor: [], evidence: ["CSV summary workflow", "三步处理流程"],
        calibrationNotes: [], diagramStatus: "insufficient-evidence", diagramRecoveryAttempted: false,
        diagramRecoveryStatus: "not-eligible", model: "fixture", rubricVersion: "fixture",
      };
    },
  });
  assert.equal(received?.skill?.path, "csv-summary/SKILL.md");
  assert.match(received?.skill?.content ?? "", /Validate headers/);

  const ordinaryMcp = await evaluate({
    name: "read-only-mcp", type: "mcp-server", readme: "# Read-only MCP\n\nProvides one read-only inspection tool.",
    hasRepository: true,
  }, { aiPolicy: "disabled", evaluatedAt: "2026-09-18T00:00:00.000Z" });
  assert.equal(ordinaryMcp.report.agentSkills, undefined);
  assert.ok(!ordinaryMcp.report.recommendation?.concerns.some((item) => /SKILL\.md|Agent Skills/.test(item)));
});

test("multi-Skill repositories report bounded coverage instead of merging instruction bodies", async () => {
  const result = await evaluate({
    ...base,
    files: [
      { path: "csv-summary/SKILL.md", content: VALID_SKILL },
      { path: "other/SKILL.md", content: VALID_SKILL.replaceAll("csv-summary", "other") },
    ],
  }, { aiPolicy: "disabled", evaluatedAt: "2026-09-18T00:00:00.000Z" });
  assert.equal(result.report.agentSkills?.detected, 2);
  assert.equal(result.report.agentSkills?.assessedPath, "csv-summary/SKILL.md");
  assert.ok(result.report.methodology.limitations.some((item) => /其余 1 个仅做格式扫描/.test(item)));
});
