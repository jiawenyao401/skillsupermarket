import assert from "node:assert/strict";
import test from "node:test";
import { growthPercentage } from "../lib/growth-metrics";

test("empty and unavailable samples are distinct from measured zero outcomes", () => {
  assert.equal(growthPercentage(0, 0), null);
  assert.equal(growthPercentage(1, 0), null);
  assert.equal(growthPercentage(undefined, 10), null);
  assert.equal(growthPercentage(0, undefined), null);
  assert.equal(growthPercentage(0, 10), 0);
  assert.equal(growthPercentage(10, 10), 100);
});

test("growth ratios preserve partial success and repeated clicks without clamping", () => {
  assert.equal(growthPercentage(1, 4), 25);
  assert.equal(growthPercentage(3, 2), 150);
  assert.equal(growthPercentage(172, 183)?.toFixed(1), "94.0");
  assert.equal(JSON.stringify({ completionRate: growthPercentage(0, 0) }), '{"completionRate":null}');
});

test("invalid counts cannot produce plausible percentages", () => {
  for (const invalid of [-1, NaN, Infinity, -Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(growthPercentage(invalid, 10), null);
    assert.equal(growthPercentage(1, invalid), null);
  }
});
