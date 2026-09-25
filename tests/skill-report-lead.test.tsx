import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SkillReportLead } from "../components/SkillReportLead";
import type { EvaluationReport } from "../lib/types";

test("skill detail gives public report evidence priority without claiming certification", () => {
  const html = renderToStaticMarkup(<SkillReportLead score={74} report={{
    summary: { headline: "适合受控试用" },
  } as EvaluationReport} />);
  assert.match(html, /综合评分 74 分，满分 100 分/);
  assert.match(html, /适合受控试用/);
  assert.match(html, /href="#evaluation-report-title"/);
  assert.match(html, /data-traffic-event="report_open_click"/);
  assert.match(html, /非安全认证或安装推荐/);
  assert.match(html, /focus-visible:outline/);
  assert.doesNotMatch(html, /href="https?:|立即安装/);
});

test("legacy and untrusted report summaries remain safe", () => {
  const fallback = renderToStaticMarkup(<SkillReportLead score={52} report={undefined} />);
  assert.match(fallback, /查看公开评测证据与采用建议/);
  const html = renderToStaticMarkup(<SkillReportLead score={52} report={{
    summary: { headline: '<script>alert("x")</script>' },
  } as EvaluationReport} />);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
