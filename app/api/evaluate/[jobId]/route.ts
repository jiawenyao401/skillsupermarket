import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { evaluationJobs, evaluations, skills } from "@/lib/schema";
import { getRequestSession, unauthorizedResponse } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getRequestSession(request);
  if (!session) return unauthorizedResponse();

  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  const [row] = await db.select({
    id: evaluationJobs.id,
    status: evaluationJobs.status,
    stage: evaluationJobs.stage,
    progress: evaluationJobs.progress,
    attempt: evaluationJobs.attempt,
    maxAttempts: evaluationJobs.maxAttempts,
    error: evaluationJobs.error,
    createdAt: evaluationJobs.createdAt,
    startedAt: evaluationJobs.startedAt,
    finishedAt: evaluationJobs.finishedAt,
    skillId: evaluationJobs.skillId,
    userId: evaluationJobs.userId,
    slug: skills.slug,
  }).from(evaluationJobs)
    .innerJoin(skills, eq(skills.id, evaluationJobs.skillId))
    .where(eq(evaluationJobs.id, jobId))
    .limit(1);

  if (!row) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  if (row.userId && row.userId !== session.user.id) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }
  const [evaluation] = row.status === "done"
    ? await db.select({ id: evaluations.id, overallScore: evaluations.overallScore })
        .from(evaluations).where(eq(evaluations.skillId, row.skillId))
        .orderBy(desc(evaluations.evaluatedAt)).limit(1)
    : [];

  return NextResponse.json({
    ...row,
    userId: undefined,
    error: row.status === "failed" ? "评测暂时失败，可稍后重新提交" : null,
    evaluationId: evaluation?.id ?? null,
    overallScore: evaluation?.overallScore ?? null,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
