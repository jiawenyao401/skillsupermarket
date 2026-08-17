import { defaultUrlTransform } from "react-markdown";

const GITHUB_REPO_URL = /^https:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?\/?$/i;

export interface ReadmeUrlContext {
  repositoryUrl: string;
  branch?: string;
  htmlUrl?: string | null;
  rawUrl?: string | null;
}

function repositoryParts(repositoryUrl: string): { owner: string; repo: string } | null {
  const match = repositoryUrl.trim().match(GITHUB_REPO_URL);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/i, "") };
}

function isRelativeUrl(value: string): boolean {
  return !/^[a-z][a-z\d+.-]*:/i.test(value) && !value.startsWith("//");
}

/** Resolve repository-relative README links without allowing unsafe protocols. */
export function transformReadmeUrl(
  value: string,
  key: string,
  context: ReadmeUrlContext
): string {
  const safeValue = defaultUrlTransform(value);
  if (!safeValue) return "";
  if (!isRelativeUrl(safeValue) || safeValue.startsWith("#")) return safeValue;

  const repository = repositoryParts(context.repositoryUrl);
  if (!repository) return safeValue;

  const canonicalBase = key === "src" ? context.rawUrl : context.htmlUrl;
  if (canonicalBase) {
    try {
      return new URL(safeValue, canonicalBase).toString();
    } catch {
      return "";
    }
  }

  const branch = encodeURIComponent(context.branch ?? "HEAD");
  const path = safeValue.replace(/^\.\//, "").replace(/^\//, "");
  const base = key === "src"
    ? `https://raw.githubusercontent.com/${repository.owner}/${repository.repo}/${branch}/`
    : `https://github.com/${repository.owner}/${repository.repo}/blob/${branch}/`;

  try {
    return new URL(path, base).toString();
  } catch {
    return "";
  }
}
