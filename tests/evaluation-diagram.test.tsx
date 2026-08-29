import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EvaluationDiagramUnavailable } from "../components/EvaluationDiagram";

test("diagram absence explains the evidence threshold instead of silently hiding the section", () => {
  const markup = renderToStaticMarkup(<EvaluationDiagramUnavailable aiJudgeUsed />);

  assert.match(markup, /公开证据不足，暂不绘图/);
  assert.match(markup, /至少 2 个步骤或组件及 1 条关系/);
  assert.match(markup, /为避免臆测/);
  assert.match(markup, /重新评测自动选图/);
});

test("legacy reports distinguish unavailable AI extraction from a diagram failure", () => {
  const markup = renderToStaticMarkup(<EvaluationDiagramUnavailable aiJudgeUsed={false} />);

  assert.match(markup, /本次报告未完成图示提取/);
  assert.match(markup, /确定性评分与安全扫描仍然有效/);
  assert.match(markup, /证据充分时会自动选择合适图型/);
});
