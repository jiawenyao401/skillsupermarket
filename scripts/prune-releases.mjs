import { lstat, readdir, realpath, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RELEASE_NAME = /^skillsupermarket-[A-Za-z0-9][A-Za-z0-9._-]*$/;

function requireSafeRelease(root, release) {
  if (path.dirname(release) !== root || !RELEASE_NAME.test(path.basename(release))) {
    throw new Error(`拒绝处理越界 release: ${release}`);
  }
}

export async function planReleasePrune({ releasesRoot, currentLink, keepRollbacks = 2 }) {
  if (!Number.isSafeInteger(keepRollbacks) || keepRollbacks < 0 || keepRollbacks > 20) {
    throw new Error("keepRollbacks 必须是 0 到 20 之间的整数");
  }

  const root = await realpath(releasesRoot);
  const current = await realpath(currentLink);
  requireSafeRelease(root, current);

  const entries = await readdir(root, { withFileTypes: true });
  const releases = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && RELEASE_NAME.test(entry.name))
    .map(async (entry) => {
      const release = path.join(root, entry.name);
      const info = await stat(release);
      return { release, mtimeMs: info.mtimeMs };
    }));

  if (!releases.some(({ release }) => release === current)) {
    throw new Error(`当前 release 不在受管目录中: ${current}`);
  }

  releases.sort((left, right) => right.mtimeMs - left.mtimeMs
    || right.release.localeCompare(left.release));

  const kept = new Set([current]);
  for (const { release } of releases) {
    if (release !== current && kept.size <= keepRollbacks) kept.add(release);
  }

  const remove = [];
  for (const { release } of releases) {
    if (kept.has(release)) continue;
    requireSafeRelease(root, release);
    const resolved = await realpath(release);
    const info = await lstat(release);
    if (resolved !== release || !info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`拒绝处理非普通 release 目录: ${release}`);
    }
    remove.push(release);
  }

  return { current, kept: [...kept], remove };
}

export async function pruneReleases(options) {
  const plan = await planReleasePrune(options);
  if (options.execute) {
    for (const release of plan.remove) {
      await rm(release, { recursive: true, force: false, maxRetries: 3, retryDelay: 200 });
    }
  }
  return plan;
}

async function main() {
  const mode = process.argv[2] ?? "--dry-run";
  if (mode !== "--dry-run" && mode !== "--execute") {
    throw new Error("用法: npm run releases:prune -- [--dry-run|--execute]");
  }

  const keepRollbacks = Number(process.env.SKILLSUPERMARKET_KEEP_ROLLBACKS ?? "2");
  const plan = await pruneReleases({
    releasesRoot: process.env.SKILLSUPERMARKET_RELEASES_ROOT ?? "/opt/releases",
    currentLink: process.env.SKILLSUPERMARKET_CURRENT_LINK ?? "/opt/skillsupermarket",
    keepRollbacks,
    execute: mode === "--execute",
  });

  console.log(`[releases] 当前版本: ${path.basename(plan.current)}`);
  console.log(`[releases] 保留 ${plan.kept.length} 份，${mode === "--execute" ? "已删除" : "待删除"} ${plan.remove.length} 份`);
  for (const release of plan.remove) console.log(`[releases] ${path.basename(release)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[releases] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
