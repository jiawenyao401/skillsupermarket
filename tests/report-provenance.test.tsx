import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getReportVersion } from "../lib/report-provenance";
import { ReportProvenance } from "../components/ReportProvenance";
import { EvaluationReport } from "../components/EvaluationReport";
import type { EvaluationReport as Report } from "../lib/types";
import { isEvaluationDestination } from "../lib/traffic";
import { HomeReportPreview } from "../components/HomeReportPreview";
import { readFileSync } from "node:fs";

test("homepage exposes stored report value before asking visitors to submit a project", () => {
  const html = renderToStaticMarkup(<HomeReportPreview example={{ slug: "example", name: "Example project",
    report: { version: "3.8.0", summary: { headline: "需要人工复核" }, recommendation: { nextActions: ["先检查权限", "再固定版本"] } },
    evaluatedAt: new Date("2026-08-28T20:00:00Z"),
  }} />);
  assert.match(html, /先看一份真实报告，无需注册/);
  assert.match(html, /报告结论：需要人工复核/);
  assert.match(html, /建议先做：先检查权限/);
  assert.doesNotMatch(html, /再固定版本/);
  assert.match(html, /v3\.8\.0/);
  assert.match(html, /2026\/08\/29/);
  assert.match(html, /href="\/skill\/example#evaluation-report-title"/);
  assert.match(html, /不是安全认证或安装推荐/);
  assert.doesNotMatch(html, /<form|\/login|\/api\/evaluate/);
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.ok(page.indexOf("<HomeReportPreview") < page.indexOf("<form"));
  assert.ok(page.includes("<HomeReportPreview example={topRated[0]} />"));
  assert.doesNotMatch(page, /收录前经过自动评测与安全扫描/);
});

test("homepage does not invent a sample, conclusion, action, version or date when data is absent", () => {
  assert.equal(renderToStaticMarkup(<HomeReportPreview />), "");
  for (const report of [null, [], "bad", {}, { summary: { headline: 4 }, recommendation: { nextActions: [null, {}, " "] } }]) {
    const html = renderToStaticMarkup(<HomeReportPreview example={{ slug: "legacy", name: "Legacy", report, evaluatedAt: new Date("invalid") }} />);
    assert.match(html, /版本未记录/);
    assert.match(html, /时间未记录/);
    assert.match(html, /href="\/skill\/legacy#evaluation-report-title"/);
    assert.doesNotMatch(html, /报告结论：|建议先做：|<time/);
  }
});

test("homepage report excerpts remain escaped and links cannot escape the skill route", () => {
  const untrusted = '<script>alert(1)</script>' + "very-long-token".repeat(80);
  const slug = 'demo/?source=https://example.invalid/"#fragment';
  const html = renderToStaticMarkup(<HomeReportPreview example={{ slug, name: untrusted,
    report: { summary: { headline: untrusted }, recommendation: { nextActions: [untrusted] } }, evaluatedAt: null }} />);
  assert.match(html, /\[overflow-wrap:anywhere\]/);
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes(`href="/skill/${encodeURIComponent(slug)}#evaluation-report-title"`));
  assert.doesNotMatch(html, /<script|href="https:/);
});

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

test("report evidence wraps long tokens without truncation or interpreting source markup", () => {
  const longPath = `scripts/${"nested-".repeat(80)}setup.sh:17`;
  const evidence = `first line\n${"unbroken-example-".repeat(100)}<script>untrusted</script>`;
  const report: Report = {
    documentation: { score: 50, details: "Example", checks: [{ id: "example", label: longPath, passed: true, weight: 10 }] },
    security: { score: 50, details: "Example", findings: [{ level: "warning", type: "example", message: "Review source", location: longPath, evidence }] },
    popularity: { score: 0, details: "Example", stats: { stars: 0, forks: 0, downloadsWeekly: 0, starsGrowth7d: 0, starsGrowth30d: 0 } },
    activity: { score: 0, details: "Example" },
    quality: { score: 50, details: "Example" },
    overall: 40,
  };
  const html = renderToStaticMarkup(<EvaluationReport report={report} evaluation={{
    overallScore: 40, documentationScore: 50, securityScore: 50, popularityScore: 0,
    activityScore: 0, qualityScore: 50, evaluatedAt: null,
  }} />);
  assert.match(html, /grid min-w-0 grid-cols-1 gap-6 \[overflow-wrap:anywhere\] lg:grid-cols-2/);
  assert.equal(html.match(/surface-card min-w-0 p-5 sm:p-6/g)?.length, 2);
  assert.match(html, /<code class="[^"]*whitespace-pre-wrap[^"]*">first line\n/);
  assert.ok(html.includes(longPath));
  assert.ok(html.includes(evidence.replace("<script>", "&lt;script&gt;").replace("</script>", "&lt;/script&gt;")));
  assert.doesNotMatch(html, /<script>untrusted/);
});
