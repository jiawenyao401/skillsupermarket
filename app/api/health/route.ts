import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { EVALUATOR_VERSION } from "@/lib/evaluation-scoring";
import { hasJudgeConfiguration } from "@/lib/judge";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const judge = hasJudgeConfiguration() ? "ready" : "unconfigured";
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({
      ok: true,
      service: "skill-supermarket",
      evaluator: EVALUATOR_VERSION,
      database: "ready",
      judge,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[health] database check failed", error);
    return NextResponse.json({
      ok: false,
      service: "skill-supermarket",
      database: "unavailable",
      judge,
      timestamp: new Date().toISOString(),
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
