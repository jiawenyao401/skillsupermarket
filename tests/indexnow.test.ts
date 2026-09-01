import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { INDEXNOW_KEY, submitIndexNowPayload } from "../lib/indexnow";

test("IndexNow ownership file matches the submitted public key", async () => {
  const content = await readFile(new URL(`../public/${INDEXNOW_KEY}.txt`, import.meta.url), "utf8");
  assert.equal(content.trim(), INDEXNOW_KEY);
});

const payload = {
  host: "skillsupermarket.com",
  key: INDEXNOW_KEY,
  keyLocation: `https://skillsupermarket.com/${INDEXNOW_KEY}.txt`,
  urlList: ["https://skillsupermarket.com/"],
};

test("IndexNow falls back to an official participant after endpoint verification failure", async () => {
  const attempts: string[] = [];
  const result = await submitIndexNowPayload(payload, (async (input) => {
    attempts.push(String(input));
    return attempts.length === 1
      ? new Response("invalid key", { status: 403 })
      : new Response("accepted", { status: 202 });
  }) as typeof fetch);

  assert.equal(result.status, 202);
  assert.equal(new URL(result.endpoint).hostname, "yandex.com");
  assert.equal(attempts.length, 2);
});

test("IndexNow stops after the first successful shared-network submission", async () => {
  let attempts = 0;
  const result = await submitIndexNowPayload(payload, (async () => {
    attempts += 1;
    return new Response(null, { status: 200 });
  }) as typeof fetch);

  assert.equal(result.status, 200);
  assert.equal(attempts, 1);
});

test("IndexNow does not bypass payload and rate-limit failures through another endpoint", async () => {
  for (const status of [400, 422, 429]) {
    let attempts = 0;
    await assert.rejects(
      submitIndexNowPayload(payload, (async () => {
        attempts += 1;
        return new Response("rejected", { status });
      }) as typeof fetch),
      new RegExp(`HTTP ${status}`),
    );
    assert.equal(attempts, 1);
  }
});
