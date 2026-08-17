// 导出数据库快照到 data/snapshots/
// 由 auto-sync.sh 调用, 也可以手动跑
// 运行: tsx scripts/export-snapshot.ts
import "dotenv/config";
import { db } from "../lib/db";
import { skills, evaluations, metricsDaily, rankings, evaluationJobs } from "../lib/schema";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const SNAPSHOT_ROOT = join(process.cwd(), "data", "snapshots");

async function exportTable<T extends Record<string, unknown>>(
  name: string,
  rows: T[]
): Promise<void> {
  const data = {
    count: rows.length,
    exported_at: new Date().toISOString(),
    rows,
  };
  // 写到当前目录 (已经 chdir 到快照目录)
  const filepath = join(process.cwd(), `${name}.json`);
  await writeFile(filepath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`  [export] ${name}: ${rows.length} rows -> ${filepath}`);
}

async function main() {
  const now = new Date();
  const stamp =
    now.toISOString().replace(/T/, "-").replace(/:/g, "").split(".")[0]; // 2026-08-12-150000
  const dir = join(SNAPSHOT_ROOT, stamp);

  await mkdir(dir, { recursive: true });
  console.log(`[snapshot] 导出到 ${dir}`);

  // 切换到快照目录
  process.chdir(dir);

  // 导出 5 张表
  await exportTable("skills", await db.select().from(skills));
  await exportTable("evaluations", await db.select().from(evaluations));
  await exportTable("metrics_daily", await db.select().from(metricsDaily));
  await exportTable("rankings", await db.select().from(rankings));
  await exportTable("evaluation_jobs", await db.select().from(evaluationJobs));

  // 写 meta
  const meta = {
    snapshot_at: now.toISOString(),
    git_commit: process.env.GIT_COMMIT ?? "unknown",
    hostname: process.env.HOSTNAME ?? "unknown",
  };
  await writeFile(join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

  // 写 latest 指向最新快照 (用绝对路径)
  await writeFile(
    join(SNAPSHOT_ROOT, "latest"),
    stamp,
    "utf-8"
  );

  console.log(`[snapshot] ✅ 完成: ${stamp}`);
  console.log(stamp); // 给 shell 脚本用
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[snapshot] 错误:", err);
    process.exit(1);
  });
