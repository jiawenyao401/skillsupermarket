import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type AuthSession } from "@/lib/auth";
import { safeReturnTo } from "@/lib/auth-utils";

export const getCurrentSession = cache(async (): Promise<AuthSession | null> => {
  return auth.api.getSession({ headers: await headers() });
});

export async function requireUser(returnTo = "/evaluate"): Promise<AuthSession> {
  const session = await getCurrentSession();
  if (!session) redirect(`/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`);
  return session;
}

export async function getRequestSession(request: Request): Promise<AuthSession | null> {
  return auth.api.getSession({ headers: request.headers });
}

export { safeReturnTo } from "@/lib/auth-utils";

export function unauthorizedResponse() {
  return Response.json(
    { error: "请先登录后使用 Skill 评测", code: "AUTH_REQUIRED" },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}
