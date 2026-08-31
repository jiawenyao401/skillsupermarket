import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, symlink, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pruneReleases } from "../scripts/prune-releases.mjs";

async function exists(target: string): Promise<boolean> {
  return access(target).then(() => true, () => false);
}

test("release retention preserves the current release and two newest rollbacks", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "skillsupermarket-releases-"));
  const releasesRoot = path.join(root, "releases");
  const currentLink = path.join(root, "current");
  await mkdir(releasesRoot);

  const releases = [
    ["skillsupermarket-current", "2026-08-20T00:00:00.000Z"],
    ["skillsupermarket-newest", "2026-08-23T00:00:00.000Z"],
    ["skillsupermarket-middle", "2026-08-22T00:00:00.000Z"],
    ["skillsupermarket-oldest", "2026-08-21T00:00:00.000Z"],
  ] as const;
  for (const [name, timestampValue] of releases) {
    const release = path.join(releasesRoot, name);
    await mkdir(release);
    const timestamp = new Date(timestampValue);
    await utimes(release, timestamp, timestamp);
  }
  await symlink(path.join(releasesRoot, "skillsupermarket-current"), currentLink);

  try {
    const dryRun = await pruneReleases({ releasesRoot, currentLink, keepRollbacks: 2, execute: false });
    assert.deepEqual(dryRun.remove.map((release: string) => path.basename(release)), ["skillsupermarket-oldest"]);
    assert.equal(await exists(path.join(releasesRoot, "skillsupermarket-oldest")), true);

    await pruneReleases({ releasesRoot, currentLink, keepRollbacks: 2, execute: true });
    assert.equal(await exists(path.join(releasesRoot, "skillsupermarket-current")), true);
    assert.equal(await exists(path.join(releasesRoot, "skillsupermarket-newest")), true);
    assert.equal(await exists(path.join(releasesRoot, "skillsupermarket-middle")), true);
    assert.equal(await exists(path.join(releasesRoot, "skillsupermarket-oldest")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
