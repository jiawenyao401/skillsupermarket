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

export function authErrorMessage(message?: string, status?: number, code?: string) {
  if (code === "EMAIL_DELIVERY_FAILED") return "验证码发送失败。账号可能已创建，请登录后重新发送验证码。";
  if (status === 429 || code === "TOO_MANY_ATTEMPTS") return "尝试次数过多，请稍后再试；验证码重发每分钟最多一次、每小时最多五次。";
  if (code === "INVALID_OTP" || code === "OTP_EXPIRED") return "验证码不正确或已过期，请检查邮件或重新发送。";
  if (status === 503 || code === "VERIFICATION_UNAVAILABLE") return "验证服务暂不可用，请稍后再试。";
  if (code === "MISSING_RESPONSE" || code === "VERIFICATION_FAILED") return "请重新完成人机验证。";
  const normalized = message?.toLowerCase() ?? "";
  if (normalized.includes("invalid email or password") || normalized.includes("invalid credentials")) return "邮箱或密码不正确";
  if (normalized.includes("already exists") || normalized.includes("already in use")) return "该邮箱已注册，请直接登录";
  if (normalized.includes("password")) return "密码不符合要求，请使用 10–128 个字符";
  return "操作未完成，请稍后重试";
}

export function emailVerificationDestination(returnTo: string): string {
  return `/verify-email?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;
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
