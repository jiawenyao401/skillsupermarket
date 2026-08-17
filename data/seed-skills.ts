// 种子数据: 手动录入一批高质量 skill 作为冷启动
// 运行: npm run seed
import { db } from "../lib/db";
import { skills } from "../lib/schema";
import { eq } from "drizzle-orm";

interface SeedSkill {
  slug: string;
  type: "claude-skill" | "mcp-server" | "agent-pack";
  name: string;
  description: string;
  tags: string[];
  category: string;
  repoUrl?: string;
  packageUrl?: string;
  authorName?: string;
  authorAvatar?: string;
  license?: string;
  currentVersion?: string;
  githubStars?: number;
  githubForks?: number;
}

const SEED: SeedSkill[] = [
  // ===== MCP Servers =====
  {
    slug: "modelcontextprotocol-server-git",
    type: "mcp-server",
    name: "@modelcontextprotocol/server-git",
    description: "MCP server for Git repository interaction. Read, search, and manipulate Git repos locally.",
    tags: ["git", "vcs", "version-control", "mcp"],
    category: "programming",
    packageUrl: "https://www.npmjs.com/package/@modelcontextprotocol/server-git",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    authorName: "Anthropic",
    authorAvatar: "https://avatars.githubusercontent.com/u/76263028?v=4",
    license: "MIT",
    currentVersion: "0.6.2",
    githubStars: 6500,
    githubForks: 1500,
  },
  {
    slug: "modelcontextprotocol-server-github",
    type: "mcp-server",
    name: "@modelcontextprotocol/server-github",
    description: "MCP server for GitHub API. Manage repos, issues, PRs from your AI.",
    tags: ["github", "git", "api", "mcp"],
    category: "programming",
    packageUrl: "https://www.npmjs.com/package/@modelcontextprotocol/server-github",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    authorName: "Anthropic",
    authorAvatar: "https://avatars.githubusercontent.com/u/76263028?v=4",
    license: "MIT",
    currentVersion: "0.6.2",
    githubStars: 6500,
    githubForks: 1500,
  },
  {
    slug: "modelcontextprotocol-server-postgres",
    type: "mcp-server",
    name: "@modelcontextprotocol/server-postgres",
    description: "MCP server for PostgreSQL. Read-only database access with schema inspection.",
    tags: ["postgres", "sql", "database", "mcp"],
    category: "data",
    packageUrl: "https://www.npmjs.com/package/@modelcontextprotocol/server-postgres",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    authorName: "Anthropic",
    authorAvatar: "https://avatars.githubusercontent.com/u/76263028?v=4",
    license: "MIT",
    currentVersion: "0.6.2",
    githubStars: 6500,
    githubForks: 1500,
  },
  {
    slug: "modelcontextprotocol-server-filesystem",
    type: "mcp-server",
    name: "@modelcontextprotocol/server-filesystem",
    description: "MCP server for filesystem access with configurable allowed directories.",
    tags: ["filesystem", "file", "io", "mcp"],
    category: "programming",
    packageUrl: "https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    authorName: "Anthropic",
    authorAvatar: "https://avatars.githubusercontent.com/u/76263028?v=4",
    license: "MIT",
    currentVersion: "0.6.2",
    githubStars: 6500,
    githubForks: 1500,
  },
  {
    slug: "modelcontextprotocol-server-brave-search",
    type: "mcp-server",
    name: "@modelcontextprotocol/server-brave-search",
    description: "MCP server for Brave Search API. Web search with privacy focus.",
    tags: ["search", "web", "brave", "mcp"],
    category: "data",
    packageUrl: "https://www.npmjs.com/package/@modelcontextprotocol/server-brave-search",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    authorName: "Anthropic",
    authorAvatar: "https://avatars.githubusercontent.com/u/76263028?v=4",
    license: "MIT",
    currentVersion: "0.6.2",
    githubStars: 6500,
    githubForks: 1500,
  },
  {
    slug: "modelcontextprotocol-server-fetch",
    type: "mcp-server",
    name: "@modelcontextprotocol/server-fetch",
    description: "MCP server for fetching web content. HTML to markdown conversion.",
    tags: ["http", "fetch", "web", "mcp"],
    category: "programming",
    packageUrl: "https://www.npmjs.com/package/@modelcontextprotocol/server-fetch",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    authorName: "Anthropic",
    authorAvatar: "https://avatars.githubusercontent.com/u/76263028?v=4",
    license: "MIT",
    currentVersion: "0.6.2",
    githubStars: 6500,
    githubForks: 1500,
  },
  {
    slug: "modelcontextprotocol-server-puppeteer",
    type: "mcp-server",
    name: "@modelcontextprotocol/server-puppeteer",
    description: "MCP server for browser automation using Puppeteer. Navigate, click, screenshot.",
    tags: ["browser", "automation", "puppeteer", "mcp"],
    category: "programming",
    packageUrl: "https://www.npmjs.com/package/@modelcontextprotocol/server-puppeteer",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    authorName: "Anthropic",
    authorAvatar: "https://avatars.githubusercontent.com/u/76263028?v=4",
    license: "MIT",
    currentVersion: "0.6.2",
    githubStars: 6500,
    githubForks: 1500,
  },
  {
    slug: "modelcontextprotocol-server-slack",
    type: "mcp-server",
    name: "@modelcontextprotocol/server-slack",
    description: "MCP server for Slack API. Read channels, post messages, manage users.",
    tags: ["slack", "chat", "team", "mcp"],
    category: "productivity",
    packageUrl: "https://www.npmjs.com/package/@modelcontextprotocol/server-slack",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    authorName: "Anthropic",
    authorAvatar: "https://avatars.githubusercontent.com/u/76263028?v=4",
    license: "MIT",
    currentVersion: "0.6.2",
    githubStars: 6500,
    githubForks: 1500,
  },
  {
    slug: "modelcontextprotocol-server-google-maps",
    type: "mcp-server",
    name: "@modelcontextprotocol/server-google-maps",
    description: "MCP server for Google Maps API. Geocoding, places, directions.",
    tags: ["maps", "geo", "location", "mcp"],
    category: "data",
    packageUrl: "https://www.npmjs.com/package/@modelcontextprotocol/server-google-maps",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    authorName: "Anthropic",
    authorAvatar: "https://avatars.githubusercontent.com/u/76263028?v=4",
    license: "MIT",
    currentVersion: "0.6.2",
    githubStars: 6500,
    githubForks: 1500,
  },

  // ===== 社区 MCP / Skills =====
  {
    slug: "stripe-mcp-stripe",
    type: "mcp-server",
    name: "stripe/agent-toolkit",
    description: "Stripe 官方 Agent Toolkit. 集成支付、客户、订阅、退款等 API, 兼容 MCP。",
    tags: ["stripe", "payment", "billing", "mcp", "finance"],
    category: "data",
    repoUrl: "https://github.com/stripe/agent-toolkit",
    authorName: "Stripe",
    authorAvatar: "https://avatars.githubusercontent.com/u/856813?v=4",
    license: "MIT",
    currentVersion: "0.2.0",
    githubStars: 480,
    githubForks: 95,
  },
  {
    slug: "mcp-server-notion",
    type: "mcp-server",
    name: "mcp-server-notion",
    description: "Notion API 的 MCP server。读、写、搜索 Notion 页面和数据库。",
    tags: ["notion", "notes", "knowledge", "mcp"],
    category: "productivity",
    packageUrl: "https://www.npmjs.com/package/@notionhq/notion-mcp-server",
    repoUrl: "https://github.com/makenotion/notion-mcp-server",
    authorName: "Notion",
    authorAvatar: "https://avatars.githubusercontent.com/u/4792552?v=4",
    license: "MIT",
    currentVersion: "1.0.0",
    githubStars: 1200,
    githubForks: 240,
  },
  {
    slug: "supabase-mcp-server",
    type: "mcp-server",
    name: "supabase/mcp-server-supabase",
    description: "Supabase 官方 MCP server。管理数据库、Auth、Storage、Edge Functions。",
    tags: ["supabase", "database", "auth", "mcp", "baas"],
    category: "data",
    repoUrl: "https://github.com/supabase/mcp-server-supabase",
    authorName: "Supabase",
    authorAvatar: "https://avatars.githubusercontent.com/u/54469796?v=4",
    license: "Apache-2.0",
    currentVersion: "0.4.0",
    githubStars: 850,
    githubForks: 120,
  },
  {
    slug: "cloudflare-mcp-server",
    type: "mcp-server",
    name: "cloudflare/mcp-server-cloudflare",
    description: "Cloudflare 官方 MCP server。管理 Workers、KV、R2、D1、Pages。",
    tags: ["cloudflare", "edge", "serverless", "mcp"],
    category: "programming",
    repoUrl: "https://github.com/cloudflare/mcp-server-cloudflare",
    authorName: "Cloudflare",
    authorAvatar: "https://avatars.githubusercontent.com/u/314135?v=4",
    license: "Apache-2.0",
    currentVersion: "0.3.0",
    githubStars: 620,
    githubForks: 95,
  },
  {
    slug: "anthropic-skills-pdf",
    type: "claude-skill",
    name: "PDF Skill (Anthropic 官方)",
    description: "Anthropic 官方 PDF 处理 skill。读取、解析、提取 PDF 文本和表格。",
    tags: ["pdf", "document", "parse", "skill"],
    category: "productivity",
    repoUrl: "https://github.com/anthropics/skills",
    authorName: "Anthropic",
    authorAvatar: "https://avatars.githubusercontent.com/u/76263028?v=4",
    license: "Apache-2.0",
    currentVersion: "1.0.0",
    githubStars: 4500,
    githubForks: 320,
  },

  // ===== Agent Packs =====
  {
    slug: "awesome-claude-code",
    type: "agent-pack",
    name: "awesome-claude-code",
    description: "Claude Code 精选资源合集。Slash commands、workflows、CLAUDE.md 模板。",
    tags: ["claude-code", "awesome", "resources", "workflow"],
    category: "programming",
    repoUrl: "https://github.com/hesreallyhim/awesome-claude-code",
    authorName: "hesreallyhim",
    authorAvatar: "https://avatars.githubusercontent.com/u/6657892?v=4",
    license: "CC0-1.0",
    githubStars: 1800,
    githubForks: 110,
  },
  {
    slug: "claude-code-templates",
    type: "agent-pack",
    name: "claude-code-templates",
    description: "Claude Code 项目模板集合。开箱即用的项目结构和 CLAUDE.md。",
    tags: ["claude-code", "template", "starter", "boilerplate"],
    category: "programming",
    repoUrl: "https://github.com/davila7/claude-code-templates",
    authorName: "davila7",
    authorAvatar: "https://avatars.githubusercontent.com/u/2906?v=4",
    license: "MIT",
    githubStars: 920,
    githubForks: 180,
  },
];

async function main() {
  console.log("[seed] 插入种子数据...");
  let added = 0;
  let updated = 0;

  for (const s of SEED) {
    const existing = await db.select().from(skills).where(eq(skills.slug, s.slug));

    if (existing.length > 0) {
      await db
        .update(skills)
        .set({
          name: s.name,
          description: s.description,
          tags: s.tags,
          category: s.category,
          githubStars: s.githubStars ?? 0,
          githubForks: s.githubForks ?? 0,
          lastUpdatedAt: new Date(),
        })
        .where(eq(skills.slug, s.slug));
      updated++;
    } else {
      await db.insert(skills).values({
        slug: s.slug,
        type: s.type,
        name: s.name,
        description: s.description,
        tags: s.tags,
        category: s.category,
        source: "manual",
        repoUrl: s.repoUrl ?? null,
        packageUrl: s.packageUrl ?? null,
        authorName: s.authorName ?? null,
        authorAvatar: s.authorAvatar ?? null,
        license: s.license ?? null,
        currentVersion: s.currentVersion ?? null,
        githubStars: s.githubStars ?? 0,
        githubForks: s.githubForks ?? 0,
      });
      added++;
    }
  }

  console.log(`[seed] ✅ 完成: 新增 ${added} 个, 更新 ${updated} 个`);
  console.log("[seed] 下一步:");
  console.log("  npm run evaluate    # 跑评测");
  console.log("  npm run rank        # 生成榜单");
  console.log("  npm run dev         # 启动网站");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] 错误:", err);
  process.exit(1);
});
