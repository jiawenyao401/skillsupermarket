import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { sourceSearchCondition, sourceSearchInput, sourceSearchPatterns } from "../lib/source-search";
import { parseEvaluationSource } from "../lib/source-parser";
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

test("source lookup normalizes known registries and rejects ambiguous or unsafe input", () => {
  assert.equal(sourceSearchInput(" https://github.com/GitHub/github-mcp-server.git/tree/main?token=omit#readme "), "https://github.com/GitHub/github-mcp-server");
  assert.equal(sourceSearchInput("https://www.npmjs.com/package/%40modelcontextprotocol%2Fserver-filesystem"), "@modelcontextprotocol/server-filesystem");
  assert.equal(sourceSearchInput("https://pypi.org/project/Example_Package/"), "pypi:Example_Package");
  for (const value of [undefined, [], ["react"], "", "x".repeat(501), "https://github.com.evil.test/a/b", "https://user:secret@github.com/a/b", "http://127.0.0.1/a/b", "javascript:alert(1)", "https://github.com:444/a/b"]) {
    assert.equal(sourceSearchInput(value), null);
  }
});

test("registry patterns keep namespace, owner and package identity boundaries", () => {
  const cases = [
    ["https://github.com/a/b.c", ["https://github.com/A/B.C.git", "https://www.github.com/a/b.c/tree/main"], ["https://github.com/a/bXc", "https://github.com/a/b.c-evil", "https://github.com/ab/c", "https://github.com.evil.test/a/b.c", "https://user:secret@github.com/a/b.c"]],
    ["@scope/tool", ["https://npmjs.com/package/@scope/tool", "https://www.npmjs.com/package/%40scope%2Ftool/"], ["https://www.npmjs.com/package/scopetool", "https://www.npmjs.com/package/@scope/tool-evil", "https://www.npmjs.com/package/@other/tool"]],
    ["pypi:Example_Package", ["https://pypi.org/project/example.package/", "https://www.pypi.org/project/example---package"], ["https://pypi.org/project/examplepackage", "https://pypi.org/project/example-package-evil"]],
  ] as const;
  for (const [input, accept, reject] of cases) {
    const pattern = new RegExp(sourceSearchPatterns(parseEvaluationSource(input)!).url, "i");
    for (const url of accept) assert.ok(pattern.test(url), url);
    for (const url of reject) assert.ok(!pattern.test(url), url);
  }
});

test("source predicates use bound parameters and invalid input can never list everything", () => {
  const dialect = new PgDialect();
  const query = dialect.sqlToQuery(sourceSearchCondition("https://github.com/a/b"));
  assert.ok(query.sql.includes("~* $"));
  assert.ok(!query.sql.includes("github\\.com"));
  assert.ok(query.params.includes("github"));
  assert.equal(dialect.sqlToQuery(sourceSearchCondition("https://private.invalid/secret")).sql, "false");
});
