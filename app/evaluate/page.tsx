import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-session";
import { EvaluationWorkbench } from "@/components/EvaluationWorkbench";
import { getQuotaSnapshot } from "@/lib/quota";
import { db } from "@/lib/db";
import { skills } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSkillEvaluationSource } from "@/lib/skill-evaluation-source";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "提交 Skill 评测",
  description: "提交公开 Skill、MCP Server 或 Agent Pack，生成证据驱动的安全与质量评测。",
  robots: { index: false, follow: false },
};

export default async function EvaluatePage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string | string[] }>;
}) {
  const session = await requireUser("/evaluate");
  const requestedSlug = (await searchParams).skill;
  const slug = typeof requestedSlug === "string" && requestedSlug.length <= 200 ? requestedSlug : null;
  const [selectedSkill] = slug
    ? await db.select({
      name: skills.name,
      source: skills.source,
      repoUrl: skills.repoUrl,
      packageUrl: skills.packageUrl,
    }).from(skills).where(eq(skills.slug, slug)).limit(1)
    : [];
  const initialSource = selectedSkill ? getSkillEvaluationSource(selectedSkill) : null;
  const quota = await getQuotaSnapshot(session.user.id);
  return <EvaluationWorkbench
    userName={session.user.name}
    initialQuota={quota}
    initialSource={initialSource}
    initialSkillName={initialSource ? selectedSkill?.name ?? null : null}
  />;
}
