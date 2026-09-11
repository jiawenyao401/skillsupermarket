import { lstatSync, readFileSync, readdirSync, realpathSync, rmdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { ImageOptimizerCache } from "next/dist/server/image-optimizer";

const probe = { href: "/brand-icon.png", width: 64, quality: 75, mimeType: "" };
export const IMAGE_PROBE_URL = "/_next/image?url=%2Fbrand-icon.png&w=64&q=75";
export const IMAGE_PROBE_CACHE_KEY = ImageOptimizerCache.getCacheKey(probe);

// Deployment CLI only: run in the release being checked. Remove just the
// rebuildable cache entry for our fixed 64px PNG, never arbitrary caller URLs.
// Next 16.3.4 disallows query strings on local image sources by default.
export function prepareLocalImageProbe(releaseRoot: string): number {
  const root = realpathSync(releaseRoot);
  if (JSON.parse(readFileSync(join(root, "package.json"), "utf8")).name !== "skill-supermarket") {
    throw new Error("Image probe requires a Skill Supermarket release");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(IMAGE_PROBE_CACHE_KEY)) throw new Error("Invalid image cache key");
  let directory = root;
  for (const part of [".next", "cache", "images", IMAGE_PROBE_CACHE_KEY]) {
    directory = join(directory, part);
    let stat;
    try { stat = lstatSync(directory); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
      throw error;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Unsafe image cache directory");
  }
  const files = readdirSync(directory);
  if (files.length > 32) throw new Error("Unexpected image cache entry count");
  // Validate every entry before removing any. No recursive deletion or glob.
  for (const file of files) {
    const stat = lstatSync(join(directory, file));
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Unsafe image cache entry");
  }
  for (const file of files) unlinkSync(join(directory, file));
  rmdirSync(directory);
  return files.length;
}
