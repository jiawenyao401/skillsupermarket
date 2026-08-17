// GET /api/search?q=xxx&type=xxx
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills } from "@/lib/schema";
import { eq, and, or, ilike, sql, desc } from "drizzle-orm";
import type { SkillType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const type = searchParams.get("type");
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));

  if (!q) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  const conditions = [
    eq(skills.status, "active"),
    or(
      ilike(skills.name, `%${q}%`),
      ilike(skills.description, `%${q}%`),
      sql`${skills.tags} && ARRAY[${q}]::text[]`
    )!,
  ];
  if (type && ["claude-skill", "mcp-server", "agent-pack"].includes(type)) {
    conditions.push(eq(skills.type, type as SkillType));
  }

  const results = await db
    .select({
      id: skills.id,
      slug: skills.slug,
      name: skills.name,
      description: skills.description,
      type: skills.type,
      category: skills.category,
      tags: skills.tags,
      githubStars: skills.githubStars,
    })
    .from(skills)
    .where(and(...conditions))
    .orderBy(desc(skills.githubStars))
    .limit(limit);

  return NextResponse.json({ q, count: results.length, items: results });
}
