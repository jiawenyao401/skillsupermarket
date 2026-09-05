import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-session";
import { safeReturnTo } from "@/lib/auth-utils";
import { getRegistrationConfig } from "@/lib/registration-config";
import { VerifyEmailSession } from "@/components/VerifyEmailSession";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "验证邮箱", robots: { index: false, follow: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const params = await searchParams;
  const target = safeReturnTo(typeof params.returnTo === "string" ? params.returnTo : null);
  const returnTo = target.startsWith("/verify-email") || target.startsWith("/login") ? "/evaluate" : target;
  const session = await requireUser(returnTo);
  if (session.user.emailVerified) redirect(returnTo);
  return <div className="mx-auto max-w-md rounded-[2rem] border bg-card p-6 sm:p-8"><VerifyEmailSession email={session.user.email} returnTo={returnTo} siteKey={getRegistrationConfig()?.siteKey ?? null} /></div>;
}
