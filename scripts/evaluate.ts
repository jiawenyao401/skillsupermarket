// 评测 worker: 从队列取任务, 跑评测
// 运行: npm run evaluate
import { db } from "../lib/db";
import { evaluationJobs } from "../lib/schema";
import { eq } from "drizzle-orm";
import { processEvaluationQueue } from "../lib/evaluator";

async function main() {
  console.log("[evaluate] === 启动评测 worker ===");

  // 跑一批
  const processed = await processEvaluationQueue(5);
  console.log(`[evaluate] ✅ 处理 ${processed} 个任务`);

  // 看队列剩余
  const remaining = await db
    .select()
    .from(evaluationJobs)
    .where(eq(evaluationJobs.status, "pending"));

  if (remaining.length > 0) {
    console.log(`[evaluate] 还有 ${remaining.length} 个 pending 任务, 再次执行:`);
    const more = await processEvaluationQueue(5);
    console.log(`[evaluate] 第二批处理 ${more} 个`);
  }

  console.log("[evaluate] 完成");
  process.exit(0);
}

main().catch((err) => {
  console.error("[evaluate] 致命错误:", err);
  process.exit(1);
});
