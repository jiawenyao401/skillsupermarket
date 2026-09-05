import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { db } from "@/lib/db";

// Reuse the persistent auth rate-limit table; concurrent requests share the
// same atomic counters across processes and deploys. No raw email in the key.
export async function reserveVerificationEmail(email: string): Promise<void> {
  const secret = process.env.ABUSE_HASH_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new APIError("SERVICE_UNAVAILABLE", { code: "VERIFICATION_UNAVAILABLE", message: "邮箱验证服务暂不可用" });
  const subject = createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex");
  const now = Date.now();
  await db.transaction(async (tx) => {
    for (const [windowMs, limit] of [[60_000, 1], [3_600_000, 5]] as const) {
      const key = `verification-email:${windowMs}:${subject}`;
      const rows = await tx.execute<{ count: number }>(sql`
        INSERT INTO rate_limit (id, key, count, last_request)
        VALUES (${randomUUID()}, ${key}, 1, ${now})
        ON CONFLICT (key) DO UPDATE SET
          count = CASE WHEN rate_limit.last_request <= ${now - windowMs} THEN 1 ELSE rate_limit.count + 1 END,
          last_request = CASE WHEN rate_limit.last_request <= ${now - windowMs} THEN ${now} ELSE rate_limit.last_request END
        WHERE rate_limit.last_request <= ${now - windowMs} OR rate_limit.count < ${limit}
        RETURNING count
      `);
      if (!rows.length) throw new APIError("TOO_MANY_REQUESTS", { code: "EMAIL_RATE_LIMITED", message: "验证码发送过于频繁，请稍后再试" });
    }
  });
}
