export function safeReturnTo(value: string | null | undefined, fallback = "/evaluate"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const parsed = new URL(value, "https://skillsupermarket.com");
    if (parsed.origin !== "https://skillsupermarket.com") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
