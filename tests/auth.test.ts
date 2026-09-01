import test from "node:test";
import assert from "node:assert/strict";
import { initialAuthMode, safeReturnTo } from "../lib/auth-utils";

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

test("initialAuthMode defaults evaluation-intent visitors to registration", () => {
  assert.equal(initialAuthMode(undefined, "/evaluate"), "register");
  assert.equal(initialAuthMode(undefined, "/evaluate?repo=demo&source=homepage"), "register");
  assert.equal(initialAuthMode(undefined, "/evaluate#submit"), "register");
});

test("initialAuthMode preserves explicit choices and ordinary login visits", () => {
  assert.equal(initialAuthMode("login", "/evaluate"), "login");
  assert.equal(initialAuthMode("register", "/account"), "register");
  assert.equal(initialAuthMode(undefined, undefined), "login");
  assert.equal(initialAuthMode(undefined, "/account"), "login");
  assert.equal(initialAuthMode(undefined, "https://evil.example/evaluate"), "login");
  assert.equal(initialAuthMode(["login", "register"], ["/evaluate", "/account"]), "login");
});
