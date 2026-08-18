import assert from "node:assert/strict";
import test from "node:test";
import { classifyTrafficSource, isAutomatedUserAgent, normalizeTrafficPath } from "../lib/traffic";

test("traffic paths keep only public funnel routes without query data", () => {
  assert.equal(normalizeTrafficPath("/"), "/");
  assert.equal(normalizeTrafficPath("/evaluation/"), "/evaluation");
  assert.equal(normalizeTrafficPath("/skill/githubgithub-mcp-server"), "/skill/githubgithub-mcp-server");
  assert.equal(normalizeTrafficPath("/guides/mcp-server-security-checklist-2026"), "/guides/mcp-server-security-checklist-2026");
  assert.equal(normalizeTrafficPath("/account"), null);
  assert.equal(normalizeTrafficPath("/search?q=secret"), null);
  assert.equal(normalizeTrafficPath("//attacker.example/path"), null);
});

test("traffic sources retain only coarse acquisition categories", () => {
  assert.equal(classifyTrafficSource(null, "skillsupermarket.com"), "direct");
  assert.equal(classifyTrafficSource("https://skillsupermarket.com/skill/x", "skillsupermarket.com"), "internal");
  assert.equal(classifyTrafficSource("https://www.google.com/search?q=mcp", "skillsupermarket.com"), "organic");
  assert.equal(classifyTrafficSource("https://github.com/modelcontextprotocol/registry", "skillsupermarket.com"), "github");
  assert.equal(classifyTrafficSource("https://www.v2ex.com/t/123", "skillsupermarket.com"), "community");
  assert.equal(classifyTrafficSource("https://example.com/private/path?token=1", "skillsupermarket.com"), "referral");
});

test("known automation is excluded while normal browsers remain countable", () => {
  assert.equal(isAutomatedUserAgent("curl/8.0"), true);
  assert.equal(isAutomatedUserAgent("Googlebot/2.1"), true);
  assert.equal(isAutomatedUserAgent("Mozilla/5.0 Chrome/140 Safari/537.36"), false);
});
