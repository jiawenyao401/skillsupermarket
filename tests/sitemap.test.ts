import assert from "node:assert/strict";
import test from "node:test";
import { skillSitemapEntry } from "../lib/sitemap-entry";

test("evaluated reports receive crawl priority and evaluation freshness", () => {
  const evaluatedAt = new Date("2026-08-31T01:00:00.000Z");
  const entry = skillSitemapEntry({
    slug: "owner/skill name",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    lastUpdatedAt: new Date("2026-08-20T00:00:00.000Z"),
    lastEvaluatedAt: evaluatedAt,
  });

  assert.equal(entry.url, "https://skillsupermarket.com/skill/owner%2Fskill%20name");
  assert.equal(entry.priority, 0.85);
  assert.deepEqual(entry.lastModified, evaluatedAt);
});

test("unevaluated inventory remains discoverable at lower crawl priority", () => {
  const updatedAt = new Date("2026-08-20T00:00:00.000Z");
  const entry = skillSitemapEntry({
    slug: "plain-skill",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    lastUpdatedAt: updatedAt,
    lastEvaluatedAt: null,
  });

  assert.equal(entry.priority, 0.6);
  assert.deepEqual(entry.lastModified, updatedAt);
});
