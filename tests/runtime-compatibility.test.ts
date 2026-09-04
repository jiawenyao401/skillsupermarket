import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

interface PackageManifest {
  engines?: { node?: string };
  overrides?: { kysely?: string };
}

interface PackageLock {
  packages?: Record<string, {
    version?: string;
    engines?: { node?: string };
  }>;
}

function readJson<T>(path: URL): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

test("locked auth database runtime supports the declared Node 20 floor", () => {
  const manifest = readJson<PackageManifest>(new URL("../package.json", import.meta.url));
  const lock = readJson<PackageLock>(new URL("../package-lock.json", import.meta.url));
  const kysely = lock.packages?.["node_modules/kysely"];

  assert.equal(manifest.engines?.node, ">=20.0.0");
  assert.equal(manifest.overrides?.kysely, "0.28.17");
  assert.equal(kysely?.version, "0.28.17");
  assert.equal(kysely?.engines?.node, ">=20.0.0");
});
