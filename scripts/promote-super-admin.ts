import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { user } from "../lib/schema";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("用法: npm run admin:promote -- account@example.com");
  }

  const promoted = await db
    .update(user)
    .set({ role: "super_admin", updatedAt: new Date() })
    .where(eq(user.email, email))
    .returning({ id: user.id, email: user.email, role: user.role });

  if (promoted.length !== 1) throw new Error(`未找到账户: ${email}`);
  console.log(`[admin] 已将 ${promoted[0].email} 设置为超级管理员`);
}

main().catch((error) => {
  console.error("[admin] 提权失败", error);
  process.exit(1);
});
