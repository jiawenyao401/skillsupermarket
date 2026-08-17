import test from "node:test";
import assert from "node:assert/strict";
import { safeReturnTo } from "../lib/auth-utils";

test("safeReturnTo accepts same-origin relative paths", () => {
  assert.equal(safeReturnTo("/evaluate?repo=demo"), "/evaluate?repo=demo");
  assert.equal(safeReturnTo("/skill/example#report"), "/skill/example#report");
});

test("safeReturnTo rejects open redirects and malformed paths", () => {
  assert.equal(safeReturnTo("https://evil.example"), "/evaluate");
  assert.equal(safeReturnTo("//evil.example/path"), "/evaluate");
  assert.equal(safeReturnTo("/\\evil.example"), "/evaluate");
  assert.equal(safeReturnTo(undefined), "/evaluate");
});
