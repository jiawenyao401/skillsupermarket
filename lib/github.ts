// GitHub API 封装
// 文档: https://docs.github.com/en/rest

const GITHUB_API = "https://api.github.com";

const headers: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "skill-supermarket",
};

if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  license: { spdx_id: string; name: string } | null;
  updated_at: string;
  pushed_at: string;
  default_branch: string;
  topics: string[];
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
}

export interface GitHubSearchResult {
  total_count: number;
  items: GitHubRepo[];
}

export async function getRepo(fullName: string): Promise<GitHubRepo | null> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${fullName}`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    }
    return res.json();
  } catch (err) {
    console.error(`[github] getRepo(${fullName}) failed:`, err);
    return null;
  }
}

export async function getReadme(
  fullName: string,
  ref?: string
): Promise<string | null> {
  try {
    const url = ref
      ? `${GITHUB_API}/repos/${fullName}/readme?ref=${ref}`
      : `${GITHUB_API}/repos/${fullName}/readme`;
    const res = await fetch(url, {
      headers: { ...headers, Accept: "application/vnd.github.raw" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

export async function searchRepos(
  query: string,
  options: {
    sort?: "stars" | "forks" | "updated";
    order?: "desc" | "asc";
    perPage?: number;
    page?: number;
  } = {}
): Promise<GitHubSearchResult> {
  const { sort = "stars", order = "desc", perPage = 30, page = 1 } = options;
  const params = new URLSearchParams({
    q: query,
    sort,
    order,
    per_page: perPage.toString(),
    page: page.toString(),
  });

  try {
    const res = await fetch(`${GITHUB_API}/search/repositories?${params}`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      throw new Error(`GitHub search ${res.status}: ${await res.text()}`);
    }
    return res.json();
  } catch (err) {
    console.error(`[github] search(${query}) failed:`, err);
    return { total_count: 0, items: [] };
  }
}

// 搜索 Skill / MCP 相关 repo
export async function searchSkills(perPage = 30): Promise<GitHubRepo[]> {
  const queries = [
    "topic:claude-skill",
    "topic:mcp-server",
    "anthropic-skills in:name",
    "claude-skill in:name,description",
    "mcp-server in:name,description",
  ];

  const all: GitHubRepo[] = [];
  const seen = new Set<number>();

  for (const q of queries) {
    const result = await searchRepos(q, { perPage });
    for (const repo of result.items) {
      if (!seen.has(repo.id)) {
        seen.add(repo.id);
        all.push(repo);
      }
    }
    // 简单节流 - 避免触发限流
    await new Promise((r) => setTimeout(r, 200));
  }

  return all.sort((a, b) => b.stargazers_count - a.stargazers_count);
}
