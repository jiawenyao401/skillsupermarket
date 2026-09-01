export type TrafficSource = "direct" | "internal" | "organic" | "github" | "community" | "referral";

const EXACT_TRACKED_PATHS = new Set([
  "/",
  "/evaluation",
  "/mcp-server-security-scan",
  "/evaluate",
  "/login",
  "/search",
  "/guides",
]);
const DYNAMIC_TRACKED_PATH = /^\/(?:skill|category|guides)\/[a-zA-Z0-9._~%-]+$/;
const COMMUNITY_HOSTS = [
  "v2ex.com",
  "zhihu.com",
  "juejin.cn",
  "reddit.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "producthunt.com",
  "news.ycombinator.com",
];

function normalizedHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function normalizeTrafficPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.length > 160 || /[\\\u0000-\u001f]/.test(trimmed)) {
    return null;
  }
  const path = trimmed.length > 1 ? trimmed.replace(/\/+$/, "") : trimmed;
  return EXACT_TRACKED_PATHS.has(path) || DYNAMIC_TRACKED_PATH.test(path) ? path : null;
}

export function isEvaluationDestination(value: string, siteOrigin: string): boolean {
  try {
    const site = new URL(siteOrigin);
    const destination = new URL(value, site);
    return destination.origin === site.origin && destination.pathname === "/evaluate";
  } catch {
    return false;
  }
}

export function classifyTrafficSource(referrer: string | null, siteHost: string): TrafficSource {
  if (!referrer) return "direct";
  let host: string;
  try {
    host = normalizedHost(new URL(referrer).hostname);
  } catch {
    return "direct";
  }
  if (!host) return "direct";
  if (host === normalizedHost(siteHost)) return "internal";
  if (
    hostMatches(host, "google.com")
    || hostMatches(host, "bing.com")
    || hostMatches(host, "baidu.com")
    || hostMatches(host, "duckduckgo.com")
    || hostMatches(host, "sogou.com")
    || hostMatches(host, "so.com")
  ) return "organic";
  if (hostMatches(host, "github.com")) return "github";
  if (COMMUNITY_HOSTS.some((domain) => hostMatches(host, domain))) return "community";
  return "referral";
}

export function isAutomatedUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return /(?:bot\b|crawler|spider|slurp|headlesschrome|lighthouse|pagespeed|curl\/|wget\/|python-requests|go-http-client|seohealth)/i.test(userAgent);
}

export function isTrustedTrafficOrigin(
  originHeader: string | null,
  requestUrl: string,
  trustedSiteUrls: readonly string[],
): boolean {
  if (!originHeader || originHeader === "null") return false;

  try {
    const origin = new URL(originHeader).origin;
    return origin === new URL(requestUrl).origin
      || trustedSiteUrls.some((siteUrl) => origin === new URL(siteUrl).origin);
  } catch {
    return false;
  }
}

export function isTrustedTrafficFetchSite(fetchSite: string | null): boolean {
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "same-site";
}
