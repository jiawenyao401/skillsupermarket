import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { safeReturnTo } from "../lib/auth-utils";

const require = createRequire(import.meta.url);

test("login recovery destination remains same-origin", () => {
  assert.equal(safeReturnTo("/evaluate"), "/evaluate");
  assert.equal(safeReturnTo("//attacker.example"), "/evaluate");
  assert.equal(safeReturnTo("https://attacker.example"), "/evaluate");
});

test("www requests permanently redirect to the canonical host", async () => {
  const nextConfig = require("../next.config.js") as {
    redirects: () => Promise<unknown[]> | unknown[];
  };
  const redirects = await nextConfig.redirects();
  assert.deepEqual(redirects, [
    {
      source: "/:path*",
      has: [{ type: "host", value: "www.skillsupermarket.com" }],
      destination: "https://skillsupermarket.com/:path*",
      permanent: true,
    },
  ]);
});
