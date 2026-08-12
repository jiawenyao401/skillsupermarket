// 榜单生成: daily / weekly / monthly
// 运行: npm run rank
import { saveRankings } from "../lib/ranker";

async function main() {
  console.log("[rank] === 生成榜单 ===");

  for (const period of ["daily", "weekly", "monthly"] as const) {
    const count = await saveRankings(period);
    console.log(`[rank] ✅ ${period}: ${count} 条记录`);
  }

  console.log("[rank] 完成");
  process.exit(0);
}

main().catch((err) => {
  console.error("[rank] 致命错误:", err);
  process.exit(1);
});
