import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { watchEvaluationProgress, type EvaluationProgress } from "../lib/evaluation-progress";

const jobId = "11111111-1111-4111-8111-111111111111";
const body = (status = "running", progress = 30) => ({ id: jobId, status, progress, stage: "quality", slug: "example-project" });
function setup(t: TestContext, fetcher: typeof fetch) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fetchMock = t.mock.method(globalThis, "fetch", fetcher);
  const updates: EvaluationProgress[] = [];
  const pauses: string[] = [];
  let unauthorized = 0;
  const stop = watchEvaluationProgress(jobId, {
    onProgress: (data) => updates.push(data), onPause: (message) => pauses.push(message),
    onUnauthorized: () => { unauthorized += 1; },
  });
  t.after(stop);
  return {
    updates, pauses, calls: () => fetchMock.mock.callCount(), unauthorized: () => unauthorized, stop,
    tick: async (ms: number) => { t.mock.timers.tick(ms); await new Promise<void>((resolve) => setImmediate(resolve)); },
  };
}

test("progress follows the same GET job through completion and stops", async (t) => {
  let calls = 0;
  const h = setup(t, async (url, options) => {
    assert.equal(url, `/api/evaluate/${jobId}`);
    assert.equal(options?.method, undefined);
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal instanceof AbortSignal);
    calls += 1;
    return Response.json({ ...body(calls === 1 ? "running" : "done", calls === 1 ? 30 : 100), error: "never expose raw errors" });
  });
  await h.tick(900); await h.tick(1800); await h.tick(60_000);
  assert.equal(h.calls(), 2);
  assert.deepEqual(h.updates.map((x) => x.status), ["running", "done"]);
  assert.equal("error" in h.updates[0], false);
  assert.deepEqual(h.pauses, []);
});

test("temporary errors are bounded to three attempts, with no invented failed task", async (t) => {
  const h = setup(t, async () => new Response("unavailable", { status: 503 }));
  await h.tick(900); await h.tick(3500); await h.tick(7000); await h.tick(60_000);
  assert.equal(h.calls(), 3);
  assert.equal(h.pauses.length, 1);
  assert.deepEqual(h.updates, []);
});

test("a successful read resets the consecutive-failure budget", async (t) => {
  let calls = 0;
  const h = setup(t, async () => {
    calls += 1;
    if ([1, 2, 4, 5].includes(calls)) throw new TypeError("Network error");
    return Response.json(body(calls === 3 ? "running" : "done", 50));
  });
  for (const ms of [900, 3500, 7000, 1800, 3500, 7000]) await h.tick(ms);
  assert.equal(h.calls(), 6);
  assert.deepEqual(h.updates.map((x) => x.status), ["running", "done"]);
  assert.deepEqual(h.pauses, []);
});

for (const status of [401, 403, 404, 429]) {
  test(`HTTP ${status} stops without retrying or changing task state`, async (t) => {
    const h = setup(t, async () => new Response("sensitive upstream text", { status }));
    await h.tick(900); await h.tick(60_000);
    assert.equal(h.calls(), 1);
    assert.equal(h.unauthorized(), status === 401 ? 1 : 0);
    assert.equal(h.pauses.length, status === 401 ? 0 : 1);
    assert.deepEqual(h.updates, []);
    assert.ok(h.pauses.every((x) => !x.includes("sensitive")));
  });
}

test("invalid JSON, mismatched job and invalid progress cannot overwrite last known state", async (t) => {
  const responses = [new Response("<html>proxy failure</html>"), Response.json({ ...body(), id: "another-job" }), Response.json(body("unknown", 101))];
  const h = setup(t, async () => responses.shift()!);
  await h.tick(900); await h.tick(3500); await h.tick(7000);
  assert.equal(h.pauses.length, 1);
  assert.deepEqual(h.updates, []);
});

test("hanging requests abort at 15 seconds and pause after three timeouts", async (t) => {
  let aborted = 0;
  const h = setup(t, async (_url, options) => new Promise<Response>((_resolve, reject) => {
    options!.signal!.addEventListener("abort", () => { aborted += 1; reject(new DOMException("Timeout", "AbortError")); }, { once: true });
  }));
  for (const ms of [900, 15_000, 3500, 15_000, 7000, 15_000, 60_000]) await h.tick(ms);
  assert.equal(h.calls(), 3);
  assert.equal(aborted, 3);
  assert.equal(h.pauses.length, 1);
  assert.deepEqual(h.updates, []);
});

test("cleanup aborts in-flight work and suppresses late responses and timers", async (t) => {
  let resolve: (response: Response) => void = () => {};
  let signal: AbortSignal | null | undefined;
  const h = setup(t, async (_url, options) => { signal = options?.signal; return new Promise<Response>((r) => { resolve = r; }); });
  await h.tick(900);
  h.stop();
  assert.equal(signal?.aborted, true);
  resolve(Response.json(body("done", 100)));
  await h.tick(60_000);
  assert.equal(h.calls(), 1);
  assert.deepEqual(h.pauses, []);
  assert.deepEqual(h.updates, []);
});

test("server-reported failure is terminal, without query-error UI", async (t) => {
  const h = setup(t, async () => Response.json(body("failed", 70)));
  await h.tick(900); await h.tick(60_000);
  assert.equal(h.calls(), 1);
  assert.equal(h.updates[0].status, "failed");
  assert.deepEqual(h.pauses, []);
});
