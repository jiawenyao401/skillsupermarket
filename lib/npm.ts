// npm Registry API 封装
// 文档: https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md

const NPM_REGISTRY = process.env.NPM_REGISTRY || "https://registry.npmjs.org";

export interface NpmPackage {
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  repository?: { url?: string };
  license?: string;
  keywords?: string[];
  maintainers?: { name: string; avatar?: string }[];
}

export interface NpmDownloadRange {
  downloads: { day: string; downloads: number }[];
}

export async function getNpmPackage(name: string): Promise<NpmPackage | null> {
  try {
    const res = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(name)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      name: data.name,
      version: data["dist-tags"]?.latest ?? data.version,
      description: data.description,
      homepage: data.homepage,
      repository: data.repository,
      license: data.license,
      keywords: data.keywords,
      maintainers: data.maintainers,
    };
  } catch (err) {
    console.error(`[npm] getPackage(${name}) failed:`, err);
    return null;
  }
}

// 拿过去 7 天下载量
export async function getNpmWeeklyDownloads(
  name: string
): Promise<number> {
  try {
    const res = await fetch(
      `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.downloads ?? 0;
  } catch {
    return 0;
  }
}

// 搜索 @modelcontextprotocol/* 等包
export async function searchNpmMcpPackages(): Promise<string[]> {
  const candidates = [
    "@modelcontextprotocol/server-git",
    "@modelcontextprotocol/server-github",
    "@modelcontextprotocol/server-postgres",
    "@modelcontextprotocol/server-filesystem",
    "@modelcontextprotocol/server-brave-search",
    "@modelcontextprotocol/server-fetch",
    "@modelcontextprotocol/server-slack",
    "@modelcontextprotocol/server-google-maps",
    "@modelcontextprotocol/server-puppeteer",
  ];

  const results: string[] = [];
  for (const name of candidates) {
    const pkg = await getNpmPackage(name);
    if (pkg) results.push(name);
    await new Promise((r) => setTimeout(r, 100));
  }
  return results;
}
