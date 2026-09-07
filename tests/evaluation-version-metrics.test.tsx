import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { summarizeEvaluationVersions } from "../lib/evaluation-version-metrics";
import { AdminEvaluationVersions } from "../components/AdminEvaluationVersions";

test("version coverage does not mistake historical reports for the current algorithm", () => {
  const metrics = summarizeEvaluationVersions([
    { version: "3.12.0", latest_reports: 1, reports_1d: 1, reports_7d: 1, reports_30d: 1 },
    { version: "3.10.0", latest_reports: 170, reports_1d: 0, reports_7d: 40, reports_30d: 180 },
    { version: null, latest_reports: 1, reports_1d: 0, reports_7d: 0, reports_30d: 2 },
  ], "3.12.0", 183);
  assert.equal(metrics.latestReports, 172);
  assert.equal(metrics.currentVersionLatestReports, 1);
  assert.equal(metrics.otherVersionLatestReports, 170);
  assert.equal(metrics.unversionedLatestReports, 1);
  assert.equal(metrics.currentVersionCoverage?.toFixed(1), "0.5");
  assert.equal(metrics.versions[1].reports30d, 180, "historical output is not latest inventory");
  assert.equal(metrics.reportSourceAttributionAvailable, false);
  const html = renderToStaticMarkup(<AdminEvaluationVersions metrics={metrics} />);
  for (const text of ["0.5%", "（当前）", "版本未知", "覆盖率不是准确率", "包含重评、运营和发布冒烟", "不是用户增长"]) assert.ok(html.includes(text), text);
  assert.ok(html.includes('scope="col"') && html.includes('scope="row"'));
});

test("empty inventories stay distinct from valid zero version coverage", () => {
  const empty = summarizeEvaluationVersions([], "3.12.0", 0);
  assert.equal(empty.currentVersionCoverage, null);
  const html = renderToStaticMarkup(<AdminEvaluationVersions metrics={empty} />);
  assert.ok(html.includes("暂无样本") && html.includes("暂无评测报告"));
  assert.equal(summarizeEvaluationVersions([], "3.12.0", 183).currentVersionCoverage, 0);
  const other = summarizeEvaluationVersions([{ version: "3.11.0", latest_reports: 1, reports_1d: 0, reports_7d: 1, reports_30d: 1 }], "3.12.0", 1);
  assert.equal(other.currentVersionCoverage, 0);
  assert.equal(other.otherVersionLatestReports, 1);
});
