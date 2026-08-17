import test from "node:test";
import assert from "node:assert/strict";
import { getSkillEvaluationSource } from "../lib/skill-evaluation-source";

test("skill details preserve the original source type for evaluation", () => {
  assert.equal(getSkillEvaluationSource({ source: "github", name: "demo", repoUrl: "https://github.com/acme/demo", packageUrl: null }), "https://github.com/acme/demo");
  assert.equal(getSkillEvaluationSource({ source: "npm", name: "@acme/demo", repoUrl: "https://github.com/acme/demo", packageUrl: "https://www.npmjs.com/package/@acme/demo" }), "https://www.npmjs.com/package/@acme/demo");
  assert.equal(getSkillEvaluationSource({ source: "pypi", name: "demo-kit", repoUrl: null, packageUrl: "https://pypi.org/project/demo-kit/" }), "pypi:demo-kit");
});

test("skill details do not create an evaluation link for unsupported sources", () => {
  assert.equal(getSkillEvaluationSource({ source: "manual", name: "private", repoUrl: "https://example.com/private", packageUrl: null }), null);
});
