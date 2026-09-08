import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getReportVersion } from "../lib/report-provenance";
import { ReportProvenance } from "../components/ReportProvenance";
import { isEvaluationDestination } from "../lib/traffic";

test("report provenance preserves stored versions and rejects inconsistent or untrusted metadata", () => {
  for (const report of [{ version: "3.10.0" }, { methodology: { evaluatorVersion: "3.10.0" } },
    { version: "3.10.0", methodology: { evaluatorVersion: "3.10.0" } }]) {
    assert.deepEqual(getReportVersion(report), { version: "3.10.0", label: "v3.10.0" });
  }
  assert.deepEqual(getReportVersion({ version: "3.10.0", methodology: { evaluatorVersion: "3.13.0" } }),
    { version: null, label: "版本记录不一致" });
  for (const report of [null, undefined, [], "3.13.0", {}, { methodology: null }]) {
    assert.equal(getReportVersion(report).version, null);
    assert.equal(getReportVersion(report).label, "版本未记录");
  }
  for (const value of ["", "<script>alert(1)</script>", 3.13, {}, ["3.13.0"], "3.13.0\n", "1.x", "9".repeat(200)]) {
    assert.deepEqual(getReportVersion({ version: value }), { version: null, label: "版本记录无效" });
    assert.equal(getReportVersion({ version: "3.13.0", methodology: { evaluatorVersion: value } }).version, null);
  }
});

test("report provenance exposes semantic time, exact versions and a safe tracked reevaluation destination", () => {
  const html = renderToStaticMarkup(<ReportProvenance report={{ version: "3.12.0" }}
    evaluatedAt={new Date("2026-09-07T12:07:26.470Z")} currentVersion="3.13.0" reevaluationSlug="modsettersurfsense" />);
  assert.match(html, /dateTime="2026-09-07T12:07:26\.470Z"/);
  assert.match(html, /20:07/);
  assert.match(html, /北京时间/);
  assert.match(html, /<section[^>]+aria-label="报告时间与版本"/);
  assert.match(html, /v3\.12\.0/);
  assert.match(html, /v3\.13\.0/);
  assert.match(html, /不同规则/);
  assert.match(html, /原分数不会自动更新/);
  assert.match(html, /href="\/evaluate\?skill=modsettersurfsense"/);
  assert.equal(isEvaluationDestination("/evaluate?skill=modsettersurfsense", "https://skillsupermarket.com"), true);
  assert.match(html, /提交才会创建任务/);
  assert.doesNotMatch(html, /<script|<form/);
});

test("same or unknown report versions never claim current project safety or fabricate timestamps", () => {
  const same = renderToStaticMarkup(<ReportProvenance report={{ version: "3.13.0" }} evaluatedAt={null} currentVersion="3.13.0" />);
  assert.match(same, /规则版本一致/);
  assert.match(same, /不代表项目代码和安全状态始终不变/);
  assert.match(same, /时间未记录/);
  assert.doesNotMatch(same, /<time|href=/);
  const unknown = renderToStaticMarkup(<ReportProvenance report={{ version: "<script>" }} evaluatedAt={new Date("invalid")} currentVersion="3.13.0" />);
  assert.match(unknown, /版本记录无效/);
  assert.match(unknown, /无法确认/);
  assert.doesNotMatch(unknown, /<script|<time|v1\.x/);
  const newer = renderToStaticMarkup(<ReportProvenance report={{ version: "4.0.0" }} evaluatedAt={null} currentVersion="3.13.0" />);
  assert.match(newer, /不同规则/);
  assert.doesNotMatch(newer, /过期|旧版/);
});

test("reevaluation slug cannot escape the same-origin workbench query", () => {
  const slug = 'demo&source=https://example.invalid/"#fragment';
  const html = renderToStaticMarkup(<ReportProvenance report={{}} evaluatedAt={null} currentVersion="3.13.0" reevaluationSlug={slug} />);
  assert.ok(html.includes(`href="/evaluate?skill=${encodeURIComponent(slug)}"`));
  assert.doesNotMatch(html, /href="https:/);
});
