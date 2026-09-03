import assert from "node:assert/strict";
import test from "node:test";
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
