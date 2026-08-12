// POST /api/evaluate - 提交评测任务
// body: { url: "https://github.com/xxx/yyy" }
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills, evaluationJobs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getRepo } from "@/lib/github";
import { getNpmPackage } from "@/lib/npm";
import { getPypiPackage } from "@/lib/pypi";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = (body.url ?? "").trim();
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    // 1. 解析 URL
    const parsed = parseUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { error: "无法解析 URL, 支持 GitHub / npm / PyPI" },
        { status: 400 }
      );
    }

    // 2. 拿元数据
    let meta: {
      slug: string;
      name: string;
      description: string | null;
      repoUrl: string | null;
      packageUrl: string | null;
      authorName: string | null;
      authorAvatar: string | null;
      authorUrl: string | null;
      license: string | null;
      type: "claude-skill" | "mcp-server" | "agent-pack";
      category: string;
      tags: string[];
    };

    if (parsed.kind === "github") {
      const repo = await getRepo(parsed.fullName);
      if (!repo) {
        return NextResponse.json(
          { error: `GitHub 仓库 ${parsed.fullName} 不存在` },
          { status: 404 }
        );
      }
      meta = {
        slug: slugify(repo.full_name),
        name: repo.name,
        description: repo.description,
        repoUrl: repo.html_url,
        packageUrl: null,
        authorName: repo.owner.login,
        authorAvatar: repo.owner.avatar_url,
        authorUrl: repo.owner.html_url,
        license: repo.license?.spdx_id ?? null,
        type: inferType(repo),
        category: inferCategory(repo),
        tags: (repo.topics ?? []).slice(0, 8),
      };
    } else if (parsed.kind === "npm") {
      const pkg = await getNpmPackage(parsed.name);
      if (!pkg) {
        return NextResponse.json(
          { error: `npm 包 ${parsed.name} 不存在` },
          { status: 404 }
        );
      }
      const repoUrl = extractGithubFromNpm(pkg.repository?.url);
      meta = {
        slug: slugify(pkg.name),
        name: pkg.name,
        description: pkg.description ?? null,
        repoUrl,
        packageUrl: `https://www.npmjs.com/package/${pkg.name}`,
        authorName: pkg.maintainers?.[0]?.name ?? null,
        authorAvatar: null,
        authorUrl: null,
        license: pkg.license ?? null,
        type: parsed.name.startsWith("@modelcontextprotocol/") ? "mcp-server" : "agent-pack",
        category: "programming",
        tags: (pkg.keywords ?? []).slice(0, 8),
      };
    } else {
      // pypi
      const pkg = await getPypiPackage(parsed.name);
      if (!pkg) {
        return NextResponse.json(
          { error: `PyPI 包 ${parsed.name} 不存在` },
          { status: 404 }
        );
      }
      meta = {
        slug: slugify(pkg.name),
        name: pkg.name,
        description: pkg.summary ?? null,
        repoUrl: pkg.home_page ?? null,
        packageUrl: `https://pypi.org/project/${pkg.name}/`,
        authorName: pkg.author ?? null,
        authorAvatar: null,
        authorUrl: null,
        license: pkg.license ?? null,
        type: "agent-pack",
        category: "programming",
        tags: (pkg.keywords?.split(",") ?? []).slice(0, 8).map((t) => t.trim()),
      };
    }

    // 3. upsert skill
    const existing = await db
      .select()
      .from(skills)
      .where(eq(skills.slug, meta.slug));

    let skillId: string;
    if (existing.length > 0) {
      skillId = existing[0].id;
      await db
        .update(skills)
        .set({
          name: meta.name,
          description: meta.description,
          type: meta.type,
          category: meta.category,
          tags: meta.tags,
          repoUrl: meta.repoUrl,
          packageUrl: meta.packageUrl,
          authorName: meta.authorName,
          authorAvatar: meta.authorAvatar,
          authorUrl: meta.authorUrl,
          license: meta.license,
          lastUpdatedAt: new Date(),
          lastIndexedAt: new Date(),
        })
        .where(eq(skills.id, skillId));
    } else {
      const [created] = await db
        .insert(skills)
        .values({
          slug: meta.slug,
          type: meta.type,
          name: meta.name,
          description: meta.description,
          tags: meta.tags,
          category: meta.category,
          source: parsed.kind === "github" ? "github" : parsed.kind === "npm" ? "npm" : "pypi",
          repoUrl: meta.repoUrl,
          packageUrl: meta.packageUrl,
          authorName: meta.authorName,
          authorAvatar: meta.authorAvatar,
          authorUrl: meta.authorUrl,
          license: meta.license,
        })
        .returning();
      if (!created) throw new Error("创建失败");
      skillId = created.id;
    }

    // 4. 创建评测任务
    await db.insert(evaluationJobs).values({
      skillId,
      triggeredBy: "user-submitted",
      status: "pending",
    });

    return NextResponse.json({
      ok: true,
      slug: meta.slug,
      skillId,
      message: "已加入评测队列, 通常 1-2 分钟完成",
    });
  } catch (err) {
    console.error("[api/evaluate] error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

// === helpers ===

type ParsedUrl =
  | { kind: "github"; fullName: string }
  | { kind: "npm"; name: string }
  | { kind: "pypi"; name: string };

function parseUrl(url: string): ParsedUrl | null {
  // github.com/owner/repo[.git][/tree/...]
  const ghMatch = url.match(
    /github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:[/?#].*)?$/i
  );
  if (ghMatch) return { kind: "github", fullName: ghMatch[1] };

  // npm: @scope/name 或 name (不能有 .)
  if (/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(url)) {
    return { kind: "npm", name: url };
  }

  // pypi: 名字中可以有 - _ . 字母数字
  if (/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(url)) {
    return { kind: "pypi", name: url };
  }

  return null;
}

function inferType(repo: { name: string; description: string | null; topics: string[] }):
  "claude-skill" | "mcp-server" | "agent-pack" {
  const text = `${repo.name} ${repo.description ?? ""} ${repo.topics.join(" ")}`.toLowerCase();
  if (text.includes("mcp") || text.includes("model-context-protocol")) return "mcp-server";
  if (text.includes("claude-skill") || text.includes("claude skill")) return "claude-skill";
  return "agent-pack";
}

function inferCategory(repo: { description: string | null; topics: string[] }): string {
  const text = `${repo.description ?? ""} ${repo.topics.join(" ")}`.toLowerCase();
  if (/data|sql|database|analytics|etl/.test(text)) return "data";
  if (/design|ui|ux|image|figma/.test(text)) return "design";
  if (/doc|email|note|productivity|markdown/.test(text)) return "productivity";
  return "programming";
}

function extractGithubFromNpm(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
  return m ? `https://github.com/${m[1]}` : null;
}
