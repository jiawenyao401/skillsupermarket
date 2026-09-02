// GitHub API 封装
// 文档: https://docs.github.com/en/rest
import { UpstreamServiceError } from "./upstream-error";

const GITHUB_API = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 12_000;

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

export interface GitHubFile {
  path: string;
  content: string;
  size: number;
}

export interface GitHubReadmeDocument {
  content: string;
  path: string;
  htmlUrl: string | null;
  rawUrl: string | null;
}

interface GitHubReadmeResponse {
  content?: string;
  encoding?: string;
  path?: string;
  html_url?: string | null;
  download_url?: string | null;
}

export async function getRepo(fullName: string, throwOnUpstreamError = false): Promise<GitHubRepo | null> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${fullName}`, {
      headers,
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new UpstreamServiceError("github", res.status, `GitHub API returned ${res.status}`);
    }
    return res.json();
  } catch (err) {
    console.error(`[github] getRepo(${fullName}) failed:`, err);
    if (throwOnUpstreamError) {
      if (err instanceof UpstreamServiceError) throw err;
      throw new UpstreamServiceError("github", undefined, "GitHub API request failed");
    }
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
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

/** Fetch README content together with canonical URLs used to resolve relative assets. */
export async function getReadmeDocument(
  fullName: string,
  ref?: string,
  throwOnUpstreamError = false,
): Promise<GitHubReadmeDocument | null> {
  try {
    const url = ref
      ? `${GITHUB_API}/repos/${fullName}/readme?ref=${encodeURIComponent(ref)}`
      : `${GITHUB_API}/repos/${fullName}/readme`;
    const res = await fetch(url, {
      headers,
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new UpstreamServiceError("github", res.status, `GitHub README API returned ${res.status}`);
    }

    const payload = await res.json() as GitHubReadmeResponse;
    const encoded = payload.content?.replace(/\s/g, "") ?? "";
    const content = payload.encoding === "base64" && encoded
      ? Buffer.from(encoded, "base64").toString("utf8")
      : payload.content ?? await getReadme(fullName, ref) ?? "";
    if (!content) return null;

    return {
      content,
      path: payload.path ?? "README.md",
      htmlUrl: payload.html_url ?? null,
      rawUrl: payload.download_url ?? null,
    };
  } catch (error) {
    if (throwOnUpstreamError) {
      if (error instanceof UpstreamServiceError) throw error;
      throw new UpstreamServiceError("github", undefined, "GitHub README API request failed");
    }
    return null;
  }
}

const ROOT_EVALUATION_FILE_CANDIDATES = [
  "SKILL.md",
  "skill.md",
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "Dockerfile",
  "docker-compose.yml",
  ".env.example",
  "SECURITY.md",
] as const;

const MAX_EVALUATION_FILES = 24;
const MAX_EVALUATION_FILE_SIZE = 250_000;
const MAX_EVALUATION_CHARACTERS = 1_200_000;
const IGNORED_PATH_SEGMENTS = new Set(["node_modules", "vendor", "dist", "build", ".next", "coverage", ".git"]);

interface GitTreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

function isHighSignalPath(path: string): boolean {
  const parts = path.split("/");
  if (parts.some((part) => IGNORED_PATH_SEGMENTS.has(part.toLowerCase()))) return false;
  const basename = parts.at(-1)?.toLowerCase() ?? "";
  return basename === "skill.md" ||
    basename === "security.md" ||
    basename === "package.json" ||
    basename === "pyproject.toml" ||
    basename === "requirements.txt" ||
    basename === "dockerfile" ||
    basename === "docker-compose.yml" ||
    basename === "docker-compose.yaml" ||
    basename === ".env.example" ||
    basename === "mcp.json";
}

function evaluationPathPriority(path: string): number {
  const depth = path.split("/").length - 1;
  const basename = path.split("/").at(-1)?.toLowerCase();
  if (basename === "skill.md") return depth;
  if (depth === 0) return 20;
  if (basename === "security.md" || basename === ".env.example") return 30 + depth;
  return 40 + depth;
}

async function fetchRawFile(fullName: string, path: string, ref?: string): Promise<GitHubFile | null> {
  try {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const encodedRepo = fullName.split("/").map(encodeURIComponent).join("/");
    const url = ref
      ? `https://raw.githubusercontent.com/${encodedRepo}/${encodeURIComponent(ref)}/${encodedPath}`
      : `${GITHUB_API}/repos/${fullName}/contents/${encodedPath}`;
    const response = await fetch(url, {
      headers: ref ? { "User-Agent": headers["User-Agent"] } : { ...headers, Accept: "application/vnd.github.raw" },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_EVALUATION_FILE_SIZE) return null;
    const content = (await response.text()).slice(0, MAX_EVALUATION_FILE_SIZE);
    return { path, content, size: content.length };
  } catch {
    return null;
  }
}

/**
 * Fetch a small, explicit set of high-signal files for static evaluation.
 * This never clones or executes repository code.
 */
export async function getEvaluationFiles(fullName: string, defaultBranch?: string): Promise<GitHubFile[]> {
  let candidates: string[] = [...ROOT_EVALUATION_FILE_CANDIDATES];
  if (defaultBranch) {
    try {
      const response = await fetch(`${GITHUB_API}/repos/${fullName}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) {
        const tree = await response.json() as { tree?: GitTreeEntry[] };
        candidates = (tree.tree ?? [])
          .filter((entry) => entry.type === "blob" && (entry.size ?? 0) <= MAX_EVALUATION_FILE_SIZE && isHighSignalPath(entry.path))
          .map((entry) => entry.path)
          .sort((a, b) => evaluationPathPriority(a) - evaluationPathPriority(b) || a.localeCompare(b));
      }
    } catch (error) {
      console.warn(`[github] recursive evidence discovery failed for ${fullName}; using root fallback`, error);
    }
  }

  const selected = [...new Set(candidates)].slice(0, MAX_EVALUATION_FILES);
  const files: GitHubFile[] = [];
  let characterBudget = MAX_EVALUATION_CHARACTERS;
  for (let index = 0; index < selected.length && characterBudget > 0; index += 6) {
    const batch = await Promise.all(selected.slice(index, index + 6).map((path) => fetchRawFile(fullName, path, defaultBranch)));
    for (const file of batch) {
      if (!file || characterBudget <= 0) continue;
      const content = file.content.slice(0, characterBudget);
      files.push({ ...file, content, size: content.length });
      characterBudget -= content.length;
    }
  }
  return files;
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
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
