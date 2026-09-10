import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { performance } from "node:perf_hooks";
import baseline from "./fixtures/sdk-parity-v3.14.0.json";
import {
  evaluate, createLLMJudge, EvaluationError, EVIDENCE_LIMITS, parseEvaluationInput,
  WEIGHTS, type EvaluationInput, type EvaluationOptions, type JudgeResult, type Judge,
} from "../packages/evaluation-sdk/src/index";
import { scanDocuments as websiteScan } from "../lib/scanner";
import { scanDocuments as sdkScan } from "../packages/evaluation-sdk/src/scanner";

const at = baseline.evaluatedAt;
const rich = baseline.fixtures[0].input as EvaluationInput;
const ai = baseline.fixtures[0].ai as JudgeResult;
const minimal: EvaluationInput = { name: "Local tool", type: "claude-skill", readme: "# Tool" };
const errorIs = (code: string) => (error: unknown) => error instanceof EvaluationError && error.code === code;
const judgeResponse = (diagram: unknown = ai.diagram) => ({
  scores: ai.scores, comment: ai.comment, evidence: ai.evidence,
  strengths: ai.strengths, concerns: ai.concerns, bestFor: ai.bestFor, avoidFor: ai.avoidFor, diagram,
});
const response = (body: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(body) } }] }));

test("SDK complete reports match six frozen pre-extraction reports over ten repeats", async (t) => {
  assert.equal(websiteScan, sdkScan);
  const times: number[] = [];
  for (const fixture of baseline.fixtures) {
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      const result = await evaluate(fixture.input as EvaluationInput, {
        evaluatedAt: at, judge: fixture.ai ? async () => fixture.ai as JudgeResult : undefined,
      });
      times.push(performance.now() - start);
      assert.deepEqual(JSON.parse(JSON.stringify(result.report)), fixture.expected, fixture.id);
    }
  }
  times.sort((a, b) => a - b);
  t.diagnostic(JSON.stringify({ baselineCommit: baseline.baselineCommit, reports: 6, repeats: 10,
    regressions: 0, drift: 0, medianMs: +times[30].toFixed(3), p95Ms: +times[57].toFixed(3), liveModelCalls: 0 }));
});

test("offline evaluation has no implicit environment or network dependency and cannot mutate weights", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Network forbidden"); };
  try {
    const first = await evaluate(minimal, { evaluatedAt: at });
    assert.equal(first.diagnostics.aiStatus, "unconfigured");
    assert.equal(first.report.methodology.aiJudgeUsed, false);
    assert.equal(first.report.methodology.diagramStatus, "judge-unavailable");
    first.report.methodology.weights.security = 0;
    const next = await evaluate(minimal, { evaluatedAt: at });
    assert.equal(next.report.methodology.weights.security, 0.25);
    assert.equal(WEIGHTS.security, 0.25);
    assert.ok(Object.isFrozen(WEIGHTS));
  } finally { globalThis.fetch = original; }
});

test("runtime schema rejects malformed, duplicate, nonfinite and oversized evidence without reflecting values", async () => {
  const invalid: unknown[] = [null, [], {}, { ...minimal, type: "other" }, { ...minimal, name: " " },
    { ...minimal, extra: "unsupported" }, { ...minimal, popularity: { stars: NaN } },
    { ...minimal, popularity: { stars: Infinity } }, { ...minimal, openIssues: -1 },
    { ...minimal, lastCommitAt: "bad-date" }, { ...minimal, readme: "a".repeat(250_001) },
    { ...minimal, files: [{ path: "README.md", content: "duplicate" }] },
    { ...minimal, files: [{ path: "a", content: "1" }, { path: "A", content: "2" }] },
    { ...minimal, files: Array.from({ length: 65 }, (_, i) => ({ path: String(i), content: "" })) },
    { ...minimal, files: Array.from({ length: 9 }, (_, i) => ({ path: String(i), content: "a".repeat(250_000) })) },
    ...["../secret", "/private/file", "C:/file", "a\\b", "./README.md", "a\nsecret", "a//b"].map((path) => ({ ...minimal, files: [{ path, content: "" }] })),
  ];
  for (const input of invalid) {
    assert.throws(() => parseEvaluationInput(input), errorIs("INVALID_INPUT"));
  }
  assert.equal(parseEvaluationInput({ ...minimal, readme: "a".repeat(EVIDENCE_LIMITS.documentCharacters) }).readme.length, 250_000);
  assert.equal(parseEvaluationInput({ ...minimal, popularity: { starsGrowth7d: -1 } }).popularity.starsGrowth7d, -1);
  assert.deepEqual(parseEvaluationInput(minimal).files, []);
});

test("policy distinguishes disabled, optional failure, required failure and absent AI", async () => {
  let calls = 0;
  const failing: Judge = async () => { calls++; throw new Error("provider body with secret=SENSITIVE"); };
  assert.equal((await evaluate(minimal, { judge: failing, aiPolicy: "disabled" })).diagnostics.aiStatus, "disabled");
  assert.equal(calls, 0);
  const fallback = await evaluate(minimal, { judge: failing });
  assert.deepEqual(fallback.diagnostics, { aiStatus: "failed", aiErrorCode: "JUDGE_FAILED" });
  assert.ok(!JSON.stringify(fallback).includes("SENSITIVE"));
  await assert.rejects(evaluate(minimal, { aiPolicy: "required" }), errorIs("JUDGE_UNAVAILABLE"));
  await assert.rejects(evaluate(minimal, { judge: failing, aiPolicy: "required" }), errorIs("JUDGE_FAILED"));
  await assert.rejects(evaluate(minimal, { evaluatedAt: "tomorrow" }), errorIs("INVALID_OPTIONS"));
  await assert.rejects(evaluate(minimal, { judgeTimeoutMs: 0 }), errorIs("INVALID_OPTIONS"));
  for (const options of [null, [], { unknown: true }, { signal: {} }]) {
    await assert.rejects(evaluate(minimal, options as unknown as EvaluationOptions), errorIs("INVALID_OPTIONS"));
  }
});

test("timeouts and cancellation do not become successful AI reports even for an uncooperative adapter", async () => {
  let received: AbortSignal | undefined;
  const hanging: Judge = (_input, context) => { received = context.signal; return new Promise(() => undefined); };
  await assert.rejects(evaluate(minimal, { judge: hanging, judgeTimeoutMs: 5, aiPolicy: "required" }), errorIs("JUDGE_TIMEOUT"));
  assert.equal(received?.aborted, true);
  assert.equal((await evaluate(minimal, { judge: hanging, judgeTimeoutMs: 5 })).diagnostics.aiErrorCode, "JUDGE_TIMEOUT");
  const controller = new AbortController();
  const pending = evaluate(minimal, { judge: hanging, signal: controller.signal });
  const timer = setTimeout(() => controller.abort("sensitive reason"), 5);
  await assert.rejects(pending, errorIs("ABORTED"));
  clearTimeout(timer);
  await assert.rejects(evaluate(minimal, { signal: controller.signal }), errorIs("ABORTED"));
});

test("progress callbacks are ordered, awaited and their failures propagate", async () => {
  const stages: string[] = [];
  await evaluate(minimal, { onStage: async (stage) => { stages.push(stage); } });
  assert.deepEqual(stages, ["security", "quality", "report"]);
  await assert.rejects(evaluate(minimal, { onStage: () => { throw new Error("queue write failed"); } }), /queue write failed/);
});

test("custom Judge output is validated, bounded and known secrets are redacted", async () => {
  for (const malformed of [null, { ...ai, score: NaN }, { ...ai, score: 1 },
    { ...ai, scores: { ...ai.scores, utility: 100 } }, { ...ai, diagram: undefined },
    { ...ai, evidence: [] }, { ...ai, diagramStatus: "insufficient-evidence" }]) {
    await assert.rejects(evaluate(rich, { judge: async () => malformed as JudgeResult, aiPolicy: "required" }), errorIs("JUDGE_FAILED"));
  }
  const secret = ["sk", "proj", "A".repeat(30)].join("-");
  const result = await evaluate(rich, { judge: async () => ({ ...ai, comment: secret }) });
  assert.ok(!JSON.stringify(result).includes(secret));
});

test("configured providers use correct endpoints and headers without implicit retries", async () => {
  for (const provider of ["deepseek", "openai", "anthropic"] as const) {
    let calls = 0;
    const judge = createLLMJudge({ provider, apiKey: "test-only-key", model: "fixture", fetch: async (url, init) => {
      calls++;
      assert.equal(init?.redirect, "error");
      assert.ok(init?.signal);
      const headers = new Headers(init?.headers);
      const body = JSON.parse(String(init?.body));
      assert.equal(body.temperature, 0);
      assert.equal(body.max_tokens, 1800);
      if (provider === "anthropic") {
        assert.equal(String(url), "https://api.anthropic.com/v1/messages");
        assert.equal(headers.get("x-api-key"), "test-only-key");
        assert.ok(body.system);
        return new Response(JSON.stringify({ content: [{ text: JSON.stringify(judgeResponse()) }] }));
      }
      assert.equal(String(url), provider === "deepseek" ? "https://api.deepseek.com/chat/completions" : "https://api.openai.com/v1/chat/completions");
      assert.equal(headers.get("Authorization"), "Bearer test-only-key");
      return response(judgeResponse());
    } });
    const result = await evaluate(rich, { judge, aiPolicy: "required", evaluatedAt: at });
    assert.equal(result.report.methodology.aiJudgeUsed, true);
    assert.equal(result.report.diagram?.type, "sequence");
    assert.equal(calls, 1);
  }
});

test("optional diagram recovery stays bounded and records genuine failure separately from quality", async () => {
  const input = { ...rich, readme: rich.readme + "\n## Architecture\nClient -> Server\n" };
  for (const recover of [true, false]) {
    let calls = 0;
    const judge = createLLMJudge({ provider: "openai", apiKey: "test", model: "fixture", fetch: async (_url, init) => {
      calls++;
      if (calls === 1) return response(judgeResponse(null));
      assert.equal(JSON.parse(String(init?.body)).max_tokens, 900);
      return recover ? response({ diagram: ai.diagram }) : new Response("secret error", { status: 503 });
    } });
    const result = await evaluate(input, { judge, aiPolicy: "required" });
    assert.equal(calls, 2);
    assert.equal(result.report.methodology.aiJudgeUsed, true);
    assert.equal(result.report.methodology.diagramRecoveryStatus, recover ? "generated" : "unavailable");
    assert.equal(Boolean(result.report.diagram), recover);
  }
});

test("invalid provider config, response, redirect and HTTP errors fail safely", async () => {
  for (const baseUrl of ["http://untrusted.example", "https://user:pass@example.com", "https://example.com?key=x", "https://example.com#fragment", "file:///etc/passwd"]) {
    assert.throws(() => createLLMJudge({ provider: "openai", apiKey: "test", model: "test", baseUrl }), errorIs("INVALID_OPTIONS"));
  }
  assert.throws(() => createLLMJudge({ provider: "openai", apiKey: " ", model: "test" }), errorIs("INVALID_OPTIONS"));
  for (const body of [() => new Response("SENSITIVE", { status: 401 }), () => new Response("redirect", { status: 302 }),
    () => new Response("a".repeat(1_048_577)), () => new Response("SENSITIVE"), () => response({ scores: "wrong" }),
    () => new Response("", { headers: { "content-length": "1048577" } })]) {
    const judge = createLLMJudge({ provider: "openai", apiKey: "test", model: "fixture", fetch: async () => body() });
    await assert.rejects(evaluate(rich, { judge, aiPolicy: "required" }), (error: unknown) => {
      assert.ok(errorIs("JUDGE_FAILED")(error));
      assert.ok(!String(error).includes("SENSITIVE"));
      return true;
    });
  }
});

test("HTTP deadline includes stalled response bodies", async () => {
  const server = createServer((_req, res) => { res.writeHead(200, { "content-type": "application/json" }); res.write('{"choices":'); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const judge = createLLMJudge({ provider: "openai", apiKey: "test", model: "fixture",
      baseUrl: `http://127.0.0.1:${address.port}`, timeoutMs: 25 });
    await assert.rejects(evaluate(rich, { judge, aiPolicy: "required" }), errorIs("JUDGE_TIMEOUT"));
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
