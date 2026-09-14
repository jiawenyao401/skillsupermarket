import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { skillSitemapEntry } from "../lib/sitemap-entry";

test("Google ownership verification keeps the original file and a persistent metadata token", () => {
  const file = readFileSync(new URL("../public/google4c98f5b1fa46b846.html", import.meta.url));
  assert.deepEqual(file, Buffer.from("google-site-verification: google4c98f5b1fa46b846.html"));
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /verification:\s*\{\s*google:\s*\[\s*"VxgQUPb8k5ZszDBkz1hO9o28isFeN2RNRQIzAULSAiI"/);
  assert.match(layout, /\.\.\.\(process\.env\.GOOGLE_SITE_VERIFICATION \? \[process\.env\.GOOGLE_SITE_VERIFICATION\] : \[\]\)/, "preserve additional configured owners");
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /matcher:\s*\["\/evaluate", "\/account", "\/admin\/:path\*", "\/login"\]/, "verification file remains outside the login boundary");
});

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
