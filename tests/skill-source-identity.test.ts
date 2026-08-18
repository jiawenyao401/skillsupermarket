import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluationSourceKey,
  evaluationSourceLookupUrls,
  resolveSourceSlug,
  skillMatchesEvaluationSource,
  sourceSlugPlan,
} from "../lib/skill-source-identity";

test("lossy base slugs do not merge scoped npm and unscoped packages", () => {
  const scoped = { kind: "npm", name: "@modelcontextprotocol/server-github" } as const;
  const attacker = { kind: "npm", name: "modelcontextprotocolserver-github" } as const;
  assert.equal(sourceSlugPlan(scoped).base, sourceSlugPlan(attacker).base);
  assert.notEqual(sourceSlugPlan(scoped).collisionSafe, sourceSlugPlan(attacker).collisionSafe);

  const target = {
    slug: sourceSlugPlan(scoped).base,
    source: "npm" as const,
    name: scoped.name,
    repoUrl: null,
    packageUrl: `https://www.npmjs.com/package/${scoped.name}`,
  };
  const resolution = resolveSourceSlug([target], attacker);
  assert.equal(resolution.existing, null);
  assert.equal(resolution.slug, sourceSlugPlan(attacker).collisionSafe);
  assert.equal(resolution.conflict, false);
  assert.equal(skillMatchesEvaluationSource(target, attacker), false);
});

test("GitHub owner boundaries remain part of the immutable identity", () => {
  const first = { kind: "github", fullName: "a/b-c" } as const;
  const second = { kind: "github", fullName: "ab-c" } as const;
  assert.equal(sourceSlugPlan(first).base, sourceSlugPlan(second).base);
  assert.notEqual(evaluationSourceKey(first), evaluationSourceKey(second));
  assert.notEqual(sourceSlugPlan(first).collisionSafe, sourceSlugPlan(second).collisionSafe);
});

test("the same canonical source keeps its established public slug", () => {
  const source = { kind: "pypi", name: "Example_Package" } as const;
  const record = {
    slug: "example-package",
    source: "pypi" as const,
    name: "example.package",
    repoUrl: null,
    packageUrl: "https://pypi.org/project/example.package/",
  };
  const resolution = resolveSourceSlug([record], source);
  assert.equal(resolution.existing, record);
  assert.equal(resolution.slug, record.slug);
  assert.equal(skillMatchesEvaluationSource(record, source), true);
});

test("legacy unattributed rows require an exact canonical public URL", () => {
  const source = { kind: "github", fullName: "openai/skills" } as const;
  const legacy = {
    slug: "openaiskills",
    source: null,
    name: "skills",
    repoUrl: "https://github.com/openai/skills",
    packageUrl: null,
  };
  assert.equal(skillMatchesEvaluationSource(legacy, source), true);
  assert.ok(sourceSlugPlan(source).collisionSafe.length <= 80);
});

test("curated manual rows keep their existing detail URL when the stored source matches", () => {
  const source = { kind: "github", fullName: "anthropics/skills" } as const;
  const curated = {
    slug: "anthropics-skills",
    source: "manual" as const,
    name: "Anthropic Skills",
    repoUrl: "https://github.com/anthropics/skills",
    packageUrl: null,
  };
  const resolution = resolveSourceSlug([curated], source);
  assert.equal(resolution.existing, curated);
  assert.equal(resolution.slug, "anthropics-skills");
  assert.deepEqual(evaluationSourceLookupUrls(source), ["https://github.com/anthropics/skills"]);
});
