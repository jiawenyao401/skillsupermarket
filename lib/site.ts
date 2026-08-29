const PRODUCTION_SITE_URL = "https://skillsupermarket.com";

function normalizeSiteUrl(value: string | undefined): string {
  if (!value) return PRODUCTION_SITE_URL;

  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    console.warn(`[site] 忽略无效的 NEXT_PUBLIC_SITE_URL: ${value}`);
    return PRODUCTION_SITE_URL;
  }
}
export const SITE_NAME = "Skill Supermarket";
export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const SITE_ORIGINS = [
  SITE_URL,
  ...(new URL(SITE_URL).hostname === "skillsupermarket.com"
    ? ["https://www.skillsupermarket.com"]
    : []),
] as const;

export function absoluteUrl(path = "/"): string {
  return new URL(path, `${SITE_URL}/`).toString();
}

export function compactDescription(value: string | null | undefined, fallback: string, maxLength = 155): string {
  const normalized = (value || fallback).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}
