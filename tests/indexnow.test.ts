import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { INDEXNOW_KEY } from "../lib/indexnow";

test("IndexNow ownership file matches the submitted public key", async () => {
  const content = await readFile(new URL(`../public/${INDEXNOW_KEY}.txt`, import.meta.url), "utf8");
  assert.equal(content.trim(), INDEXNOW_KEY);
});
