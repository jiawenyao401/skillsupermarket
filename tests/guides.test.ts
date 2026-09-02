import assert from "node:assert/strict";
import test from "node:test";
import { GUIDES, getGuide } from "../lib/guides";

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
    ]).join("");

    assert.ok(guide.title.length >= 12, `${guide.slug} needs a descriptive title`);
    assert.ok(guide.description.length >= 40, `${guide.slug} needs a useful description`);
    assert.ok(body.length >= 500, `${guide.slug} is too thin`);
    assert.ok(guide.sources.length >= 2, `${guide.slug} needs sources`);
    assert.ok(guide.sources.some((source) => source.url.startsWith("http")), `${guide.slug} needs a primary external source`);
  }
});
