export type EvaluationSource =
  | { kind: "github"; fullName: string }
  | { kind: "npm"; name: string }
  | { kind: "pypi"; name: string };

const NPM_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const PYPI_NAME = /^[a-z0-9][a-z0-9._-]*$/i;
const GITHUB_SEGMENT = /^[a-z0-9_.-]+$/i;

/** Parse only known public registries so evaluation can never become an SSRF proxy. */
export function parseEvaluationSource(input: string): EvaluationSource | null {
  let value = input.trim();
  try {
    if (/^https?:\/\//i.test(value)) {
      const parsedUrl = new URL(value);
      if (parsedUrl.username || parsedUrl.password || parsedUrl.port) return null;
      const host = parsedUrl.hostname.toLowerCase();
      if (host === "github.com" || host === "www.github.com") {
        const parts = parsedUrl.pathname.split("/").filter(Boolean);
        if (parts.length < 2 || !GITHUB_SEGMENT.test(parts[0]) || !GITHUB_SEGMENT.test(parts[1].replace(/\.git$/i, ""))) return null;
        return { kind: "github", fullName: `${parts[0]}/${parts[1].replace(/\.git$/i, "")}` };
      }
      if (host === "npmjs.com" || host === "www.npmjs.com") {
        const packagePath = parsedUrl.pathname.match(/^\/package\/(.+)$/)?.[1];
        if (!packagePath) return null;
        value = decodeURIComponent(packagePath).replace(/\/$/, "");
      } else if (host === "pypi.org" || host === "www.pypi.org") {
        const name = parsedUrl.pathname.match(/^\/project\/([^/]+)\/?$/)?.[1];
        return name && PYPI_NAME.test(name) ? { kind: "pypi", name } : null;
      } else {
        return null;
      }
    }
  } catch {
    return null;
  }

  if (value.toLowerCase().startsWith("pypi:")) {
    const name = value.slice(5);
    return PYPI_NAME.test(name) ? { kind: "pypi", name } : null;
  }
  return NPM_NAME.test(value) ? { kind: "npm", name: value } : null;
}

export function extractGithubUrl(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/github\.com[/:]([^/\s]+\/[^/#\s]+?)(?:\.git)?$/i);
  return match ? `https://github.com/${match[1].replace(/\.git$/i, "")}` : null;
}
