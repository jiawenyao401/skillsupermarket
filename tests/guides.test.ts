import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import GuidePage, { generateMetadata } from "../app/guides/[slug]/page";
import { GUIDES, getGuide, getRelatedGuides } from "../lib/guides";

test("guide slugs and canonical lookup remain unique", () => {
  const slugs = GUIDES.map((guide) => guide.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const guide of GUIDES) assert.equal(getGuide(guide.slug), guide);
});

test("guides meet the minimum evidence and depth floor", () => {
  for (const guide of GUIDES) {
    const body = guide.sections.flatMap((section) => [
      ...(section.paragraphs ?? []),
      ...(section.bullets ?? []),
      ...(section.code ? [section.code] : []),
    ]).join("");

    assert.ok(guide.title.length >= 12, `${guide.slug} needs a descriptive title`);
    assert.ok(guide.description.length >= 40, `${guide.slug} needs a useful description`);
    assert.ok(body.length >= 500, `${guide.slug} is too thin`);
    assert.ok(guide.sources.length >= 2, `${guide.slug} needs sources`);
    assert.ok(guide.sources.some((source) => source.url.startsWith("http")), `${guide.slug} needs a primary external source`);
  }
});

test("guide command examples never contain real credentials", () => {
  for (const guide of GUIDES) {
    for (const section of guide.sections) {
      if (!section.code) continue;
      assert.ok(section.code.length >= 12, `${guide.slug} has an empty command example`);
      assert.doesNotMatch(section.code, /(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]{12,}/, `${guide.slug} contains a credential-like value`);
    }
  }
});

test("related guides form valid, intentional internal links", () => {
  const inbound = new Map(GUIDES.map((guide) => [guide.slug, 0]));

  for (const guide of GUIDES) {
    assert.equal(guide.relatedSlugs.length, 3, `${guide.slug} should have three related guides`);
    assert.equal(new Set(guide.relatedSlugs).size, guide.relatedSlugs.length, `${guide.slug} repeats a related guide`);
    assert.ok(!guide.relatedSlugs.includes(guide.slug), `${guide.slug} links to itself`);
    assert.equal(getRelatedGuides(guide).length, guide.relatedSlugs.length, `${guide.slug} contains a missing related guide`);

    for (const slug of guide.relatedSlugs) inbound.set(slug, (inbound.get(slug) ?? 0) + 1);
  }

  for (const [slug, count] of inbound) assert.ok(count > 0, `${slug} has no inbound related-guide link`);
});

test("MCP recommendation guide connects a bounded PR task to real public evidence", async () => {
  const slug = "claude-code-mcp-server-recommendations-2026";
  const guide = getGuide(slug)!;
  const section = guide.sections.find((item) => item.reportLink);
  assert.equal(section?.reportLink?.slug, "githubgithub-mcp-server");
  const body = [...(section?.paragraphs ?? []), ...(section?.bullets ?? [])].join("\n");
  for (const boundary of ["不是本站已执行", "疑似告警", "底层凭证", "私有测试仓库", "公共仓库", "停止接入", "运行时审计"]) {
    assert.ok(body.includes(boundary), `missing adoption boundary: ${boundary}`);
  }
  assert.ok(guide.sources.some(({ url }) => /\/blob\/[a-f0-9]{40}\/docs\/remote-server\.md$/.test(url)));
  const props = { params: Promise.resolve({ slug }) };
  const html = renderToStaticMarkup(await GuidePage(props));
  const link = 'href="/skill/githubgithub-mcp-server#evaluation-report-title"';
  assert.ok(html.includes(link));
  assert.ok(html.indexOf(link) < html.indexOf('aria-labelledby="guide-sources"'));
  assert.ok(html.indexOf(link) < html.indexOf("免费开始评测"));
  assert.ok(html.includes("免登录查看 GitHub MCP 报告与风险证据"));
  assert.ok(html.includes('"dateModified":"2026-09-09"'));
  assert.deepEqual((await generateMetadata(props)).alternates, { canonical: `/guides/${slug}` });
  const unchanged = renderToStaticMarkup(await GuidePage({ params: Promise.resolve({ slug: "claude-code-mcp-setup-2026" }) }));
  assert.ok(!unchanged.includes(link), "other guides must not receive an unrelated report");
});

test("guide report links remain explicit local skill references", () => {
  for (const guide of GUIDES) {
    for (const { reportLink } of guide.sections) {
      if (!reportLink) continue;
      assert.match(reportLink.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.ok(reportLink.label.length >= 8);
    }
  }
});
