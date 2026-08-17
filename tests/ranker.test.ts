import assert from "node:assert/strict";
import test from "node:test";
import { calcHotScore, rankingDateKey, rankingWindowStart } from "../lib/ranker";

test("ranking date keys use the configured business timezone", () => {
  const instant = new Date("2026-08-12T16:30:00.000Z");
  assert.equal(rankingDateKey(instant, "Asia/Shanghai"), "2026-08-13");
});

test("ranking windows include exactly 1, 7 and 30 calendar days", () => {
  const date = new Date("2026-08-13T04:00:00.000Z");
  assert.equal(rankingWindowStart("daily", date), "2026-08-13");
  assert.equal(rankingWindowStart("weekly", date), "2026-08-07");
  assert.equal(rankingWindowStart("monthly", date), "2026-07-15");
});

test("hot score rewards growth, downloads and activity", () => {
  const baseline = calcHotScore({ starsDelta: 0, downloadsSignal: 0, activityScore: 0, mentionCount: 0 });
  const trending = calcHotScore({ starsDelta: 20, downloadsSignal: 500, activityScore: 1, mentionCount: 0 });
  assert.equal(baseline, 0);
  assert.ok(trending > baseline);
});
