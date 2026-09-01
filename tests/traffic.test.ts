import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyTrafficSource,
  isAutomatedUserAgent,
  isEvaluationDestination,
  isTrustedTrafficFetchSite,
  isTrustedTrafficOrigin,
  normalizeTrafficPath,
} from "../lib/traffic";

test("evaluation CTA destinations include prefilled same-origin forms only", () => {
  const origin = "https://skillsupermarket.com";
  assert.equal(isEvaluationDestination("/evaluate", origin), true);
  assert.equal(isEvaluationDestination("/evaluate?source=https%3A%2F%2Fgithub.com%2Facme%2Fdemo", origin), true);
  assert.equal(isEvaluationDestination("https://skillsupermarket.com/evaluate", origin), true);
  assert.equal(isEvaluationDestination("https://attacker.example/evaluate", origin), false);
  assert.equal(isEvaluationDestination("/evaluation", origin), false);
  assert.equal(isEvaluationDestination("not a url", "not an origin"), false);
});

test("traffic paths keep only public funnel routes without query data", () => {
  assert.equal(normalizeTrafficPath("/"), "/");
  assert.equal(normalizeTrafficPath("/evaluation/"), "/evaluation");
  assert.equal(normalizeTrafficPath("/mcp-server-security-scan/"), "/mcp-server-security-scan");
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

test("traffic origin accepts the canonical site behind a reverse proxy", () => {
  assert.equal(isTrustedTrafficOrigin(
    "https://skillsupermarket.com",
    "http://127.0.0.1:3000/api/events",
    ["https://skillsupermarket.com", "https://www.skillsupermarket.com"],
  ), true);
  assert.equal(isTrustedTrafficOrigin(
    "https://www.skillsupermarket.com",
    "http://127.0.0.1:3000/api/events",
    ["https://skillsupermarket.com", "https://www.skillsupermarket.com"],
  ), true);
  assert.equal(isTrustedTrafficOrigin(
    "http://localhost:3000",
    "http://localhost:3000/api/events",
    ["https://skillsupermarket.com"],
  ), true);
});

test("traffic origin rejects missing, opaque, malformed, and foreign origins", () => {
  const requestUrl = "http://127.0.0.1:3000/api/events";
  const siteUrls = ["https://skillsupermarket.com", "https://www.skillsupermarket.com"];
  assert.equal(isTrustedTrafficOrigin(null, requestUrl, siteUrls), false);
  assert.equal(isTrustedTrafficOrigin("null", requestUrl, siteUrls), false);
  assert.equal(isTrustedTrafficOrigin("not a url", requestUrl, siteUrls), false);
  assert.equal(isTrustedTrafficOrigin("https://attacker.example", requestUrl, siteUrls), false);
});

test("traffic fetch metadata permits only same-origin and explicit same-site aliases", () => {
  assert.equal(isTrustedTrafficFetchSite(null), true);
  assert.equal(isTrustedTrafficFetchSite("same-origin"), true);
  assert.equal(isTrustedTrafficFetchSite("same-site"), true);
  assert.equal(isTrustedTrafficFetchSite("cross-site"), false);
  assert.equal(isTrustedTrafficFetchSite("none"), false);
});
