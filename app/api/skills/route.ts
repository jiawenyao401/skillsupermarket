// GET /api/skills - 列表
// GET /api/skills?slug=xxx - 详情
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills, evaluations } from "@/lib/schema";
import { eq, desc, and, or, ilike, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const type = searchParams.get("type");
  const category = searchParams.get("category");
  const q = searchParams.get("q");
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10));

  // 详情
  if (slug) {
    const [skill] = await db
      .select()
      .from(skills)
      .where(eq(skills.slug, slug));
    if (!skill) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.skillId, skill.id))
      .orderBy(desc(evaluations.evaluatedAt))
      .limit(1);
    return NextResponse.json({ skill, evaluation });
  }

  // 列表
  const conditions = [eq(skills.status, "active")];
  if (type && ["claude-skill", "mcp-server", "agent-pack"].includes(type)) {
    conditions.push(eq(skills.type, type as any));
  }
  if (category) {
    conditions.push(eq(skills.category, category));
  }
  if (q) {
    conditions.push(
      or(
        ilike(skills.name, `%${q}%`),
        ilike(skills.description, `%${q}%`)
      )!
    );
  }

  const list = await db
    .select({
      id: skills.id,
      slug: skills.slug,
      name: skills.name,
      description: skills.description,
      type: skills.type,
      category: skills.category,
      tags: skills.tags,
      authorName: skills.authorName,
      githubStars: skills.githubStars,
      license: skills.license,
    })
    .from(skills)
    .where(and(...conditions))
    .orderBy(desc(skills.githubStars))
    .limit(limit);

  return NextResponse.json({ count: list.length, items: list });
}
