import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const monitorScript = path.resolve("scripts/security-monitor.sh");

function runMonitor(projectDir: string, stateDir: string, mode: string, env: Record<string, string> = {}) {
  return spawnSync("bash", [monitorScript, mode], {
    encoding: "utf8",
    env: { ...process.env, PROJECT_DIR: projectDir, SECURITY_STATE_DIR: stateDir, ...env },
  });
}

test("code baseline acceptance is release-bound and leaves host baselines unchanged", {
  skip: process.platform !== "linux" ? "production security monitor requires Linux utilities" : false,
}, () => {
  const root = mkdtempSync(path.join(tmpdir(), "skillsupermarket-security-monitor-"));
  const projectDir = path.join(root, "release");
  const otherRelease = path.join(root, "other-release");
  const stateDir = path.join(root, "state");

  try {
    mkdirSync(path.join(projectDir, "app"), { recursive: true });
    mkdirSync(otherRelease);
    mkdirSync(stateDir);
    writeFileSync(path.join(projectDir, "app", "page.tsx"), "export default function Page() { return null; }\n");
    writeFileSync(path.join(projectDir, "package.json"), "{}\n");
    writeFileSync(path.join(stateDir, "code.sha256"), "old-code-baseline\n");
    writeFileSync(path.join(stateDir, "accounts.txt"), "trusted-account\n");
    writeFileSync(path.join(stateDir, "authorized-keys.sha256"), "trusted-key\n");
    writeFileSync(path.join(stateDir, "listeners.txt"), "trusted-port\n");

    const digestResult = runMonitor(projectDir, stateDir, "--code-digest");
    assert.equal(digestResult.status, 0, digestResult.stderr);
    const digest = digestResult.stdout.match(/digest=([0-9a-f]{64})/)?.[1];
    assert.ok(digest);

    const unapproved = runMonitor(projectDir, stateDir, "--accept-code", {
      SECURITY_EXPECTED_RELEASE: projectDir,
      SECURITY_EXPECTED_CODE_MANIFEST_SHA256: digest,
    });
    assert.equal(unapproved.status, 4);

    const wrongRelease = runMonitor(projectDir, stateDir, "--accept-code", {
      SECURITY_CODE_BASELINE_APPROVED: "1",
      SECURITY_EXPECTED_RELEASE: otherRelease,
      SECURITY_EXPECTED_CODE_MANIFEST_SHA256: digest,
    });
    assert.equal(wrongRelease.status, 5);

    const accepted = runMonitor(projectDir, stateDir, "--accept-code", {
      SECURITY_CODE_BASELINE_APPROVED: "1",
      SECURITY_EXPECTED_RELEASE: projectDir,
      SECURITY_EXPECTED_CODE_MANIFEST_SHA256: digest,
    });
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.match(accepted.stdout, /CODE_BASELINE_UPDATED/);
    assert.notEqual(readFileSync(path.join(stateDir, "code.sha256"), "utf8"), "old-code-baseline\n");
    assert.equal(readFileSync(path.join(stateDir, "accounts.txt"), "utf8"), "trusted-account\n");
    assert.equal(readFileSync(path.join(stateDir, "authorized-keys.sha256"), "utf8"), "trusted-key\n");
    assert.equal(readFileSync(path.join(stateDir, "listeners.txt"), "utf8"), "trusted-port\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
