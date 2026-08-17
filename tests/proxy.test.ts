import test from "node:test";
import assert from "node:assert/strict";
import { safeReturnTo } from "../lib/auth-utils";

test("login recovery destination remains same-origin", () => {
  assert.equal(safeReturnTo("/evaluate"), "/evaluate");
  assert.equal(safeReturnTo("//attacker.example"), "/evaluate");
  assert.equal(safeReturnTo("https://attacker.example"), "/evaluate");
});
