// PyPI API 封装
// 文档: https://warehouse.pypa.io/api-reference/
import { UpstreamServiceError } from "./upstream-error";

const PYPI_INDEX = process.env.PYPI_INDEX || "https://pypi.org";
const PYPI_API = `${PYPI_INDEX}/pypi`;
const REQUEST_TIMEOUT_MS = 12_000;

export interface PypiPackage {
  name: string;
  version: string;
  summary?: string;
  home_page?: string;
  project_url?: string;
  license?: string;
  keywords?: string;
  author?: string;
}

export async function getPypiPackage(name: string, throwOnUpstreamError = false): Promise<PypiPackage | null> {
  try {
    const res = await fetch(`${PYPI_API}/${encodeURIComponent(name)}/json`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new UpstreamServiceError("pypi", res.status, `PyPI returned ${res.status}`);
    const data = await res.json();
    const info = data.info;
    return {
      name: info.name,
      version: info.version,
      summary: info.summary,
      home_page: info.home_page,
      project_url: info.project_url,
      license: extractLicense(info.license),
      keywords: info.keywords,
      author: info.author,
    };
  } catch (err) {
    console.error(`[pypi] getPackage(${name}) failed:`, err);
    if (throwOnUpstreamError) {
      if (err instanceof UpstreamServiceError) throw err;
      throw new UpstreamServiceError("pypi", undefined, "PyPI request failed");
    }
    return null;
  }
}

function extractLicense(license: unknown): string | undefined {
  if (typeof license === "string") return license;
  if (Array.isArray(license) && license.length > 0) {
    return typeof license[0] === "string" ? license[0] : undefined;
  }
  return undefined;
}

// 拿 pypistats.org 的下载统计
export async function getPypiWeeklyDownloads(name: string): Promise<number> {
  try {
    const res = await fetch(
      `https://pypistats.org/api/packages/${encodeURIComponent(name)}/recent`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.data?.last_week ?? 0;
  } catch {
    return 0;
  }
}
