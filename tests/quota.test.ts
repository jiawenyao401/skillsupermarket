import test from "node:test";
import assert from "node:assert/strict";
import { FREE_WEEKLY_EVALUATION_LIMIT, getShanghaiWeekWindow } from "../lib/quota-policy";

test("free plan grants ten evaluations per week", () => {
  assert.equal(FREE_WEEKLY_EVALUATION_LIMIT, 10);
});

test("quota week starts at Monday midnight in Shanghai", () => {
  const window = getShanghaiWeekWindow(new Date("2026-08-13T04:00:00.000Z"));
  assert.equal(window.periodStart, "2026-08-10");
  assert.equal(window.startsAt.toISOString(), "2026-08-09T16:00:00.000Z");
  assert.equal(window.endsAt.toISOString(), "2026-08-16T16:00:00.000Z");
});

test("quota rolls over exactly at Shanghai Monday midnight", () => {
  const before = getShanghaiWeekWindow(new Date("2026-08-16T15:59:59.999Z"));
  const after = getShanghaiWeekWindow(new Date("2026-08-16T16:00:00.000Z"));
  assert.equal(before.periodStart, "2026-08-10");
  assert.equal(after.periodStart, "2026-08-17");
});
