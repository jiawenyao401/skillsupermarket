import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = resolve(root, "artifacts");
mkdirSync(destination, { recursive: true });
const packed = spawnSync("npm", ["pack", "./packages/evaluation-sdk", "--pack-destination", destination, "--json"], {
  cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024,
});
if (packed.status !== 0) {
  process.stderr.write(packed.stderr || packed.stdout || "SDK pack failed\n");
  process.exit(packed.status ?? 1);
}
const [metadata] = JSON.parse(packed.stdout);
const path = resolve(destination, metadata.filename);
console.log(JSON.stringify({ path, bytes: metadata.size, sha256: createHash("sha256").update(readFileSync(path)).digest("hex"), files: metadata.files.length }));
