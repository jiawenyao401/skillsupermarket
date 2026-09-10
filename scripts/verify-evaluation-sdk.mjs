import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const run = (command, args, cwd, expected = 0) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== expected) {
    process.stderr.write(result.stdout + result.stderr);
    throw new Error(`SDK verification failed: ${command} exited ${result.status}; expected ${expected}`);
  }
  return result.stdout;
};

const packed = JSON.parse(run(process.execPath, [resolve(root, "scripts/pack-evaluation-sdk.mjs")], root));
const files = run("tar", ["-tzf", packed.path], root).trim().split("\n");
assert.ok(files.includes("package/dist/index.d.ts"));
assert.ok(files.includes("package/LICENSE"));
assert.ok(files.includes("package/README.md"));
assert.ok(files.every((file) => /^package\/(?:dist\/|examples\/|README\.md$|LICENSE$|package\.json$)/.test(file)));
assert.ok(files.every((file) => !/(?:\.env|\.pem|\.log|node_modules|\.cache)/.test(file)));

const consumer = mkdtempSync(resolve(tmpdir(), "skillsupermarket-sdk-consumer-"));
writeFileSync(resolve(consumer, "package.json"), JSON.stringify({ name: "sdk-consumer-check", private: true, type: "module" }));
run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--registry=https://registry.npmjs.org",
  ...(process.env.SDK_INSTALL_OFFLINE === "1" ? ["--offline"] : []), packed.path], consumer);
const installed = resolve(consumer, "node_modules/@skill-supermarket/evaluation-sdk");
const dependencies = JSON.parse(run("npm", ["ls", "--all", "--json"], consumer));
const forbidden = new Set(["next", "react", "drizzle-orm", "pg", "postgres", "better-auth", "dotenv"]);
function checkTree(node) {
  for (const [name, dependency] of Object.entries(node.dependencies ?? {})) {
    assert.ok(!forbidden.has(name), `SDK pulled website dependency: ${name}`);
    checkTree(dependency);
  }
}
checkTree(dependencies);
for (const name of ["sdk-consumer.mjs", "sdk-consumer.mts"]) {
  cpSync(resolve(root, "tests/fixtures", name), resolve(consumer, name));
}
run(process.execPath, ["sdk-consumer.mjs"], consumer);
run(process.execPath, ["--input-type=commonjs", "-e", "import('@skill-supermarket/evaluation-sdk').then(sdk => sdk.evaluate({name:'CJS consumer',type:'agent-pack',readme:''})).then(r => {if (!r.report.version) process.exit(1)})"], consumer);
run(process.execPath, [resolve(root, "node_modules/typescript/bin/tsc"), "--strict", "--noEmit",
  "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "sdk-consumer.mts"], consumer);
const fixture = resolve(installed, "examples/input.json");
const offline = JSON.parse(run(process.execPath, [resolve(installed, "examples/offline.mjs"), fixture], consumer));
assert.equal(offline.diagnostics.aiStatus, "disabled");
const ci = JSON.parse(run(process.execPath, [resolve(installed, "examples/ci.mjs"), fixture], consumer, 2));
assert.equal(ci.requiresReview, true); // Fixture has intentionally low confidence.
run(process.execPath, [resolve(installed, "examples/offline.mjs")], consumer, 1);
assert.ok(!existsSync(resolve(installed, ".env")));
assert.equal(JSON.parse(readFileSync(resolve(installed, "package.json"), "utf8")).license, "Apache-2.0");
console.log(JSON.stringify({ status: "passed", package: packed.path, sha256: packed.sha256, consumer,
  checks: ["package-allowlist", "isolated-install", "no-website-dependencies", "esm", "commonjs-dynamic-import", "typescript", "offline-example", "ci-policy", "usage-error", "license"] }));
