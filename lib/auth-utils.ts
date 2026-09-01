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

type AuthMode = "login" | "register";
type SearchParam = string | string[] | null | undefined;

function firstSearchParam(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

export function initialAuthMode(mode: SearchParam, returnTo: SearchParam): AuthMode {
  const explicitMode = firstSearchParam(mode);
  if (explicitMode === "login" || explicitMode === "register") return explicitMode;

  const requestedDestination = firstSearchParam(returnTo);
  if (!requestedDestination) return "login";

  const destination = safeReturnTo(requestedDestination, "/");
  return destination === "/evaluate" || destination.startsWith("/evaluate?") || destination.startsWith("/evaluate#")
    ? "register"
    : "login";
}
